import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSafeSpacing } from '@/hooks/useSafeSpacing';
import { alertWriteError } from '@/lib/alertWriteError';
import { supabase } from '@/lib/supabase';
import { Search, Trash2, Plus, Package, Users } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { IngredientCard, type PantryIngredient } from '@/components/pantry/IngredientCard';
import { ExpiryEditModal } from '@/components/pantry/ExpiryEditModal';
import { sortByUrgency } from '@/lib/expiry';
import { maybeAskNotificationPermission } from '@/lib/notifications';
import { notifyPantryChanged, onPantryChanged } from '@/lib/pantryEvents';
import { activeHouseholdId } from '@/lib/household';
import { useHousehold } from '@/hooks/useHousehold';

export default function IngredientsScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const safe = useSafeSpacing();
  const [ingredients, setIngredients] = useState<PantryIngredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<PantryIngredient[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingExpiry, setEditingExpiry] = useState<PantryIngredient | null>(null);
  const [savingExpiry, setSavingExpiry] = useState(false);
  const household = useHousehold();

  // Garde-manger partagé : rechargé quand un membre le modifie (temps réel) ou qu'on change de foyer
  useEffect(() => onPantryChanged(loadIngredients), [user]);

  // « Ajouté par » (foyer partagé seulement) : moi, un membre, ou un ancien membre
  const addedBy = (authorId: string | null): string | undefined => {
    if (!household?.shared) return undefined;
    const member = household.members.find((m) => m.user_id === authorId);
    if (!member) return t('household.formerMember');
    return member.is_me ? t('household.me') : member.name;
  };

  // Rechargé à chaque retour sur l'onglet (ingrédients ajoutés depuis la caméra, par exemple)
  useFocusEffect(
    useCallback(() => {
      loadIngredients();
    }, [user])
  );

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredIngredients(ingredients);
    } else {
      const filtered = ingredients.filter((ingredient) =>
        ingredient.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredIngredients(filtered);
    }
  }, [searchQuery, ingredients]);

  const loadIngredients = async () => {
    if (!user) return;

    const householdId = await activeHouseholdId();
    if (!householdId) return;

    // Pas de setLoading(true) : le spinner plein écran ne s'affiche qu'au premier chargement,
    // les rechargements au retour sur l'onglet se font en arrière-plan
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('household_id', householdId)
      .order('created_at', { ascending: false });

    if (data) {
      // Par urgence : expirés et proches d'abord, sans date à la fin
      const sorted = sortByUrgency(data as PantryIngredient[]);
      setIngredients(sorted);
      setFilteredIngredients(sorted);
    }
    setLoading(false);
  };

  const deleteIngredient = async (id: string) => {
    Alert.alert(
      t('pantry.deleteTitle'),
      t('pantry.deleteText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeleting(id);
            const { error } = await supabase
              .from('ingredients')
              .delete()
              .eq('id', id);

            if (error) {
              alertWriteError(t, 'deleting ingredient', error);
            } else {
              setIngredients(ingredients.filter((ing) => ing.id !== id));
              notifyPantryChanged();
            }
            setDeleting(null);
          },
        },
      ]
    );
  };

  const saveExpiry = async (expiresAt: string | null) => {
    if (!editingExpiry) return;
    setSavingExpiry(true);
    const { error } = await supabase
      .from('ingredients')
      .update({ expires_at: expiresAt })
      .eq('id', editingExpiry.id);
    setSavingExpiry(false);

    if (error) {
      alertWriteError(t, 'updating expiry date', error);
      return;
    }
    const id = editingExpiry.id;
    setIngredients(sortByUrgency(ingredients.map((ing) => ing.id === id ? { ...ing, expires_at: expiresAt } : ing)));
    setEditingExpiry(null);
    notifyPantryChanged();
    if (expiresAt) await maybeAskNotificationPermission();
  };

  const clearAllIngredients = () => {
    Alert.alert(
      t('pantry.clearTitle'),
      t('pantry.clearText'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('pantry.clearTitle'),
          style: 'destructive',
          onPress: async () => {
            const householdId = await activeHouseholdId();
            if (!user || !householdId) return;

            setLoading(true);
            const { error } = await supabase
              .from('ingredients')
              .delete()
              .eq('household_id', householdId);

            if (error) {
              alertWriteError(t, 'clearing ingredients', error);
            } else {
              setIngredients([]);
              setFilteredIngredients([]);
              notifyPantryChanged();
            }
            setLoading(false);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, safe.top(20)]}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('pantry.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {household?.shared
              ? t('household.pantrySubtitle', { count: ingredients.length, members: household.members.length })
              : t('ingredientCount', { count: ingredients.length })}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.householdButton}
            onPress={() => router.push('/household')}
            accessibilityLabel={t('household.title')}
          >
            <Users size={20} color="#10b981" />
          </TouchableOpacity>
          {ingredients.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearAllIngredients}
            >
              <Trash2 size={20} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('pantry.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {ingredients.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Package size={64} color="#d1d5db" strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{t('pantry.emptyTitle')}</Text>
          <Text style={styles.emptyText}>
            {t('pantry.emptyText')}
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(tabs)/camera')}
          >
            <Plus size={20} color="#fff" />
            <Text style={styles.addButtonText}>{t('pantry.addIngredients')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.ingredientList}
            showsVerticalScrollIndicator={false}
          >
            {filteredIngredients.length === 0 ? (
              <View style={styles.noResults}>
                <Text style={styles.noResultsText}>{t('pantry.noResults')}</Text>
              </View>
            ) : (
              filteredIngredients.map((ingredient) => (
                <IngredientCard
                  key={ingredient.id}
                  ingredient={ingredient}
                  deleting={deleting === ingredient.id}
                  onDelete={() => deleteIngredient(ingredient.id)}
                  onEditExpiry={() => setEditingExpiry(ingredient)}
                  addedBy={addedBy(ingredient.user_id)}
                />
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={() => router.push('/(tabs)/camera')}
            >
              <Plus size={20} color="#10b981" />
              <Text style={styles.addMoreButtonText}>{t('pantry.addMore')}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <ExpiryEditModal
        ingredient={editingExpiry}
        saving={savingExpiry}
        onSave={saveExpiry}
        onClose={() => setEditingExpiry(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  clearButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  headerText: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  householdButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0fdf4',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#111827',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ingredientList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  noResults: {
    padding: 40,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: '#6b7280',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  addMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#10b981',
    borderStyle: 'dashed',
  },
  addMoreButtonText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
  },
});
