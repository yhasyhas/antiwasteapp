import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

type Language = 'fr' | 'en' | 'es';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
  loading: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  fr: {
    welcome: 'Bienvenue',
    welcomeBack: 'Bon retour !',
    readyToCook: 'Prêt à cuisiner ?',
    youHave: 'Vous avez',
    ingredient: 'ingrédient',
    ingredients: 'ingrédients',
    ready: 'prêt',
    scanFood: 'Scanner',
    takePhoto: 'Prenez une photo',
    myPantry: 'Mon garde-manger',
    savedRecipes: 'Recettes sauvegardées',
    recentRecipes: 'Recettes récentes',
    seeAll: 'Voir tout',
    settings: 'Paramètres',
    language: 'Langue',
    selectLanguage: 'Sélectionner la langue',
    french: 'Français',
    english: 'English',
    spanish: 'Español',
    difficulty: 'Difficulté',
    mealType: 'Type de repas',
    dietaryPreferences: 'Préférences alimentaires',
    breakfast: 'Petit-déjeuner',
    lunch: 'Déjeuner',
    dinner: 'Dîner',
    snack: 'Goûter',
    easy: 'Facile',
    medium: 'Moyen',
    expert: 'Expert',
    generate: 'Générer',
    generateRecipes: 'Générer des recettes',
    cancel: 'Annuler',
    save: 'Sauvegarder',
    delete: 'Supprimer',
    add: 'Ajouter',
    addIngredients: 'Ajouter des ingrédients',
    signOut: 'Se déconnecter',
    minutes: 'minutes',
    servings: 'personnes',
    prepTime: 'Préparation',
    cookTime: 'Cuisson',
    totalTime: 'Total',
    instructions: 'Instructions',
    tips: 'Astuces',
    noIngredients: 'Aucun ingrédient',
    addIngredientsFirst: 'Ajoutez des ingrédients d\'abord',
    cameraPermission: 'Permission caméra requise',
    grantPermission: 'Accorder la permission',
    analyzeError: 'Erreur d\'analyse',
    tryAgain: 'Réessayer',
    confirmIngredients: 'Confirmer les ingrédients',
    addManually: 'Ajouter manuellement',
    saveIngredients: 'Sauvegarder les ingrédients',
    analyzingPhoto: 'Analyse de ta photo…',
    analyzingHint: 'Cela peut prendre quelques secondes',
    checkYourEmail: 'Vérifie ta boîte mail',
    checkYourEmailText: 'Nous avons envoyé un lien de confirmation à {email}. Ouvre-le pour activer ton compte, puis connecte-toi.',
    backToLogin: 'Retour à la connexion',
  },
  en: {
    welcome: 'Welcome',
    welcomeBack: 'Welcome back!',
    readyToCook: 'Ready to Cook?',
    youHave: 'You have',
    ingredient: 'ingredient',
    ingredients: 'ingredients',
    ready: 'ready',
    scanFood: 'Scan Food',
    takePhoto: 'Take a photo',
    myPantry: 'My pantry',
    savedRecipes: 'Saved recipes',
    recentRecipes: 'Recent Recipes',
    seeAll: 'See All',
    settings: 'Settings',
    language: 'Language',
    selectLanguage: 'Select language',
    french: 'Français',
    english: 'English',
    spanish: 'Español',
    difficulty: 'Difficulty',
    mealType: 'Meal type',
    dietaryPreferences: 'Dietary preferences',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
    easy: 'Easy',
    medium: 'Medium',
    expert: 'Expert',
    generate: 'Generate',
    generateRecipes: 'Generate Recipes',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    add: 'Add',
    addIngredients: 'Add Ingredients',
    signOut: 'Sign Out',
    minutes: 'minutes',
    servings: 'servings',
    prepTime: 'Prep time',
    cookTime: 'Cook time',
    totalTime: 'Total time',
    instructions: 'Instructions',
    tips: 'Tips',
    noIngredients: 'No ingredients',
    addIngredientsFirst: 'Add ingredients first',
    cameraPermission: 'Camera permission required',
    grantPermission: 'Grant permission',
    analyzeError: 'Analysis error',
    tryAgain: 'Try again',
    confirmIngredients: 'Confirm Ingredients',
    addManually: 'Add Manually',
    saveIngredients: 'Save Ingredients',
    analyzingPhoto: 'Analyzing your photo…',
    analyzingHint: 'This can take a few seconds',
    checkYourEmail: 'Check your inbox',
    checkYourEmailText: 'We sent a confirmation link to {email}. Open it to activate your account, then sign in.',
    backToLogin: 'Back to sign in',
  },
  es: {
    welcome: 'Bienvenido',
    welcomeBack: '¡Bienvenido de nuevo!',
    readyToCook: '¿Listo para cocinar?',
    youHave: 'Tienes',
    ingredient: 'ingrediente',
    ingredients: 'ingredientes',
    ready: 'listo',
    scanFood: 'Escanear',
    takePhoto: 'Toma una foto',
    myPantry: 'Mi despensa',
    savedRecipes: 'Recetas guardadas',
    recentRecipes: 'Recetas recientes',
    seeAll: 'Ver todo',
    settings: 'Ajustes',
    language: 'Idioma',
    selectLanguage: 'Seleccionar idioma',
    french: 'Français',
    english: 'English',
    spanish: 'Español',
    difficulty: 'Dificultad',
    mealType: 'Tipo de comida',
    dietaryPreferences: 'Preferencias dietéticas',
    breakfast: 'Desayuno',
    lunch: 'Almuerzo',
    dinner: 'Cena',
    snack: 'Merienda',
    easy: 'Fácil',
    medium: 'Medio',
    expert: 'Experto',
    generate: 'Generar',
    generateRecipes: 'Generar recetas',
    cancel: 'Cancelar',
    save: 'Guardar',
    delete: 'Eliminar',
    add: 'Añadir',
    addIngredients: 'Añadir ingredientes',
    signOut: 'Cerrar sesión',
    minutes: 'minutos',
    servings: 'porciones',
    prepTime: 'Tiempo de prep',
    cookTime: 'Tiempo de cocción',
    totalTime: 'Tiempo total',
    instructions: 'Instrucciones',
    tips: 'Consejos',
    noIngredients: 'Sin ingredientes',
    addIngredientsFirst: 'Añade ingredientes primero',
    cameraPermission: 'Permiso de cámara requerido',
    grantPermission: 'Conceder permiso',
    analyzeError: 'Error de análisis',
    tryAgain: 'Intentar de nuevo',
    confirmIngredients: 'Confirmar ingredientes',
    addManually: 'Añadir manualmente',
    saveIngredients: 'Guardar ingredientes',
    analyzingPhoto: 'Analizando tu foto…',
    analyzingHint: 'Puede tardar unos segundos',
    checkYourEmail: 'Revisa tu correo',
    checkYourEmailText: 'Enviamos un enlace de confirmación a {email}. Ábrelo para activar tu cuenta y luego inicia sesión.',
    backToLogin: 'Volver al inicio de sesión',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('fr');
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    loadLanguage();
  }, []);

  useEffect(() => {
    if (user) {
      syncWithSupabase();
    }
  }, [user]);

  const loadLanguage = async () => {
    try {
      const storedLang = await AsyncStorage.getItem('app_language');
      if (storedLang) {
        setLanguageState(storedLang as Language);
        setLoading(false);
        return;
      }

      const deviceLang = navigator.language?.substring(0, 2) || 'fr';
      const detectedLang = ['fr', 'en', 'es'].includes(deviceLang) ? deviceLang : 'fr';
      
      setLanguageState(detectedLang as Language);
      await AsyncStorage.setItem('app_language', detectedLang);
    } catch (error) {
      console.error('Error loading language:', error);
      setLanguageState('fr');
    } finally {
      setLoading(false);
    }
  };

  const syncWithSupabase = async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('user_preferences')
        .select('default_language')
        .eq('user_id', user.id)
        .single();

      if (data?.default_language && data.default_language !== language) {
        setLanguageState(data.default_language as Language);
        await AsyncStorage.setItem('app_language', data.default_language);
      }
    } catch (error) {
      console.error('Error syncing with Supabase:', error);
    }
  };

  const setLanguage = async (newLang: Language) => {
    try {
      setLanguageState(newLang);
      await AsyncStorage.setItem('app_language', newLang);

      if (user) {
        await supabase
          .from('user_preferences')
          .upsert({
            user_id: user.id,
            default_language: newLang,
            updated_at: new Date().toISOString(),
          });
      }
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key: string): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};