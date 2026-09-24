import React, { useState, useEffect } from 'react';
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
import { alertWriteError } from '@/lib/alertWriteError';
import { supabase } from '@/lib/supabase';
import { Search, Trash2, Plus, Package } from 'lucide-react-native';
import { router } from 'expo-router';

interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  added_via: string;
  created_at: string;
}

export default function IngredientsScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [filteredIngredients, setFilteredIngredients] = useState<Ingredient[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadIngredients();
  }, []);

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

    setLoading(true);
    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setIngredients(data);
      setFilteredIngredients(data);
    }
    setLoading(false);
  };

  const deleteIngredient = async (id: string) => {
    Alert.alert(
      'Delete Ingredient',
      'Are you sure you want to remove this ingredient?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
            }
            setDeleting(null);
          },
        },
      ]
    );
  };

  const clearAllIngredients = () => {
    Alert.alert(
      'Clear All Ingredients',
      'Are you sure you want to remove all ingredients from your pantry?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;

            setLoading(true);
            const { error } = await supabase
              .from('ingredients')
              .delete()
              .eq('user_id', user.id);

            if (error) {
              alertWriteError(t, 'clearing ingredients', error);
            } else {
              setIngredients([]);
              setFilteredIngredients([]);
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
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Pantry</Text>
          <Text style={styles.headerSubtitle}>
            {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {ingredients.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={clearAllIngredients}
          >
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <Search size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search ingredients..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {ingredients.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Package size={64} color="#d1d5db" strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>No Ingredients Yet</Text>
          <Text style={styles.emptyText}>
            Start adding ingredients to generate delicious recipes
          </Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/(tabs)/camera')}
          >
            <Plus size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add Ingredients</Text>
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
                <Text style={styles.noResultsText}>No ingredients found</Text>
              </View>
            ) : (
              filteredIngredients.map((ingredient) => (
                <View key={ingredient.id} style={styles.ingredientCard}>
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{ingredient.name}</Text>
                    {ingredient.quantity ? (
                      <Text style={styles.ingredientQuantity}>
                        {ingredient.quantity}
                      </Text>
                    ) : null}
                    <View style={styles.ingredientMeta}>
                      <View
                        style={[
                          styles.badge,
                          ingredient.added_via === 'camera'
                            ? styles.badgeCamera
                            : styles.badgeManual,
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            ingredient.added_via === 'camera'
                              ? styles.badgeTextCamera
                              : styles.badgeTextManual,
                          ]}
                        >
                          {ingredient.added_via === 'camera'
                            ? 'Scanned'
                            : 'Manual'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => deleteIngredient(ingredient.id)}
                    disabled={deleting === ingredient.id}
                    style={styles.deleteButton}
                  >
                    {deleting === ingredient.id ? (
                      <ActivityIndicator size="small" color="#ef4444" />
                    ) : (
                      <Trash2 size={20} color="#ef4444" />
                    )}
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.addMoreButton}
              onPress={() => router.push('/(tabs)/camera')}
            >
              <Plus size={20} color="#10b981" />
              <Text style={styles.addMoreButtonText}>Add More Ingredients</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
    paddingTop: 60,
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
  ingredientCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  ingredientQuantity: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  ingredientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeCamera: {
    backgroundColor: '#ede9fe',
  },
  badgeManual: {
    backgroundColor: '#dbeafe',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextCamera: {
    color: '#7c3aed',
  },
  badgeTextManual: {
    color: '#2563eb',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 12,
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
