import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import i18n, { isSupportedLanguage, type Language } from '@/i18n';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

export type { Language };

// Langue choisie, gardée sur le téléphone
const LANGUAGE_KEY = 'app_language';
// Présent tant que la langue choisie n'a pas pu être enregistrée dans Supabase (hors connexion)
const PENDING_SYNC_KEY = 'app_language_pending_sync';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: TFunction;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [language, setLanguageState] = useState<Language>(i18n.language as Language);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const applyLanguage = async (lang: Language) => {
    setLanguageState(lang);
    await i18n.changeLanguage(lang);
  };

  // Langue gardée sur le téléphone ; au premier lancement, i18n a déjà pris celle du téléphone
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (isSupportedLanguage(stored)) await applyLanguage(stored);
      } catch (error) {
        console.error('Error loading language:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Enregistre la langue dans Supabase. Renvoie false hors connexion (réessayé plus tard).
  const pushToSupabase = async (lang: Language): Promise<boolean> => {
    const userId = userIdRef.current;
    if (!userId) return false;
    try {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          default_language: lang,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' }); // une seule ligne par utilisateur (contrainte unique sur user_id)
      if (error) throw error;
      await AsyncStorage.removeItem(PENDING_SYNC_KEY);
      return true;
    } catch (error) {
      console.warn('[langue] synchronisation avec Supabase reportée :', error);
      return false;
    }
  };

  // À la connexion et au retour dans l'app : envoie un choix resté en attente, sinon reprend celui du compte
  const syncWithSupabase = async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    try {
      if (await AsyncStorage.getItem(PENDING_SYNC_KEY)) {
        const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (isSupportedLanguage(stored)) await pushToSupabase(stored);
        return;
      }
      const { data } = await supabase
        .from('user_preferences')
        .select('default_language')
        .eq('user_id', userId)
        .maybeSingle(); // pas encore de préférences pour un nouveau compte : ce n'est pas une erreur

      if (isSupportedLanguage(data?.default_language) && data.default_language !== i18n.language) {
        await applyLanguage(data.default_language);
        await AsyncStorage.setItem(LANGUAGE_KEY, data.default_language);
      }
    } catch (error) {
      console.warn('[langue] lecture de la langue du compte impossible :', error);
    }
  };

  useEffect(() => {
    if (user) syncWithSupabase();
  }, [user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncWithSupabase();
    });
    return () => subscription.remove();
  }, []);

  // Le changement s'applique tout de suite et reste sur le téléphone ; hors connexion, il est envoyé
  // à Supabase plus tard, sans message d'erreur
  const setLanguage = async (newLang: Language) => {
    await applyLanguage(newLang);
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, newLang);
      await AsyncStorage.setItem(PENDING_SYNC_KEY, '1');
    } catch (error) {
      console.error('Error saving language:', error);
    }
    await pushToSupabase(newLang);
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
