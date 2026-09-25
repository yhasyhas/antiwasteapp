import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Jeton de rafraîchissement absent, expiré ou déjà utilisé : la session enregistrée est inutilisable
function isInvalidRefreshToken(error: AuthError) {
  return (
    error.code === 'refresh_token_not_found' ||
    error.code === 'refresh_token_already_used' ||
    /refresh token/i.test(error.message)
  );
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error loading session:', error);
          if (isInvalidRefreshToken(error)) {
            // Nettoie la session enregistrée sur cet appareil ; user reste null → écran de connexion
            await supabase.auth.signOut({ scope: 'local' });
          }
          setSession(null);
          setUser(null);
          return;
        }

        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (e) {
        console.error('Error loading session:', e);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Appel Supabase différé : en faire un dans ce callback peut bloquer supabase-js
        const { id, email } = session.user;
        setTimeout(() => ensureProfile(id, email), 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const ensureProfile = async (id: string, email: string | undefined) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;

      if (!profile) {
        const { error: insertError } = await supabase.from('profiles').insert({ id, email: email! });
        if (insertError) throw insertError;
      }
    } catch (e) {
      console.error('Error creating profile:', e);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (e) {
      return { error: e };
    }
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    // Confirmation d'email active : le compte est créé mais sans session tant que le lien n'est pas ouvert
    return { error, needsEmailConfirmation: !error && !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
