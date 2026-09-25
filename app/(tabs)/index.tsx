import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { ChefHat, Sparkles, TrendingUp } from 'lucide-react-native';
import { router, useFocusEffect } from 'expo-router';
import { RecentRecipeCard, type RecentRecipe } from '@/components/home/RecentRecipeCard';
import { RecipeSummaryModal } from '@/components/home/RecipeSummaryModal';

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<RecentRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<RecentRecipe | null>(null);

  // Rechargé à chaque retour sur l'onglet : ingrédients scannés, recettes générées entre-temps
  useFocusEffect(
    useCallback(() => {
      loadIngredients();
      loadRecipes();
    }, [user])
  );

  const loadIngredients = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('ingredients')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setIngredients(data);
    }
  };

  const loadRecipes = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setRecipes(data);
    }
  };

  const handleGenerateRecipes = () => {
    if (ingredients.length === 0) {
      return;
    }
    router.push('/recipe/generate');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{t('welcomeBack')}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
          <Text style={styles.logoutText}>{t('signOut')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <ChefHat size={40} color="#10b981" strokeWidth={2} />
          </View>
          <Text style={styles.heroTitle}>{t('readyToCook')}</Text>
          <Text style={styles.heroSubtitle}>
            {t('youHave')} {ingredients.length} {ingredients.length !== 1 ? t('ingredients') : t('ingredient')} {t('ready')}
          </Text>
          <TouchableOpacity
            style={[
              styles.generateButton,
              ingredients.length === 0 && styles.generateButtonDisabled,
            ]}
            onPress={handleGenerateRecipes}
            disabled={ingredients.length === 0}
          >
            <Sparkles size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.generateButtonText}>{t('generateRecipes')}</Text>
          </TouchableOpacity>
          {ingredients.length === 0 && (
            <Text style={styles.helpText}>
              {t('addIngredientsFirst')}
            </Text>
          )}
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/camera')}
          >
            <View style={styles.actionIconContainer}>
              <ChefHat size={24} color="#10b981" />
            </View>
            <Text style={styles.actionTitle}>{t('scanFood')}</Text>
            <Text style={styles.actionSubtitle}>{t('takePhoto')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/ingredients')}
          >
            <View style={styles.actionIconContainer}>
              <TrendingUp size={24} color="#10b981" />
            </View>
            <Text style={styles.actionTitle}>{t('myPantry')}</Text>
            <Text style={styles.actionSubtitle}>{ingredients.length} {t('ingredients')}</Text>
          </TouchableOpacity>
        </View>

        {recipes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('recentRecipes')}</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/saved')}>
                <Text style={styles.seeAllText}>{t('seeAll')}</Text>
              </TouchableOpacity>
            </View>

            {recipes.map((recipe) => (
              <RecentRecipeCard key={recipe.id} recipe={recipe} onPress={() => setSelectedRecipe(recipe)} />
            ))}
          </View>
        )}
      </ScrollView>

      {selectedRecipe && (
        <RecipeSummaryModal recipe={selectedRecipe} onClose={() => setSelectedRecipe(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  email: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  logoutText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  heroCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    marginTop: 12,
    fontSize: 14,
    color: '#9ca3af',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  seeAllText: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '600',
  },
});