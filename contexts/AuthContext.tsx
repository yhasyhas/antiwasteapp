import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// TEMPORAIRE (phase 0.5) : logs pour diagnostiquer la connexion. À retirer une fois le problème réglé.
const log = (...args: unknown[]) => console.log('[auth]', ...args);

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
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      log('lecture de la session enregistrée…');
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          log('getSession : erreur', error.code, error.message);
          if (isInvalidRefreshToken(error)) {
            // Nettoie la session enregistrée sur cet appareil ; user reste null → écran de connexion
            log('jeton de rafraîchissement invalide : signOut local');
            await supabase.auth.signOut({ scope: 'local' });
          }
          setSession(null);
          setUser(null);
          return;
        }

        log('getSession :', data.session ? `connecté (${data.session.user.email})` : 'aucune session');
        setSession(data.session);
        setUser(data.session?.user ?? null);
      } catch (e) {
        log('getSession : exception', e);
        setSession(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      log('changement d\'état :', event, session ? `(${session.user.email})` : '(pas de session)');
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
        log('création du profil');
        const { error: insertError } = await supabase.from('profiles').insert({ id, email: email! });
        if (insertError) throw insertError;
      }
    } catch (e) {
      log('profil : erreur', e);
    }
  };

  const signIn = async (email: string, password: string) => {
    log('signInWithPassword : envoi…');
    const started = Date.now();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      log(
        `signInWithPassword : réponse en ${Date.now() - started} ms`,
        error ? `erreur ${error.code} ${error.message}` : `ok, session ${data.session ? 'présente' : 'absente'}`
      );
      return { error };
    } catch (e) {
      log('signInWithPassword : exception', e);
      return { error: e };
    }
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
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
