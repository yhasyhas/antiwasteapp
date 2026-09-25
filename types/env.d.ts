declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_SUPABASE_URL: string;
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
      // Facultatif : sans DSN, Sentry reste inactif
      EXPO_PUBLIC_SENTRY_DSN?: string;
    }
  }
}

export {};
