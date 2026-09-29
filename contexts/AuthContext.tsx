import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { unregisterPush } from '@/lib/pushNotifications';

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
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, captchaToken?: string) => Promise<{ error: any; needsEmailConfirmation: boolean }>;
  // Essai sans compte (connexion anonyme Supabase)
  signInAnonymously: (captchaToken?: string) => Promise<{ error: any }>;
  // Compte anonyme → vrai compte : même identifiant, toutes les données sont gardées
  upgradeAccount: (email: string, password: string) => Promise<{ error: any }>;
  isAnonymous: boolean;
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
        // Compte anonyme : pas d'adresse e-mail
        const { error: insertError } = await supabase.from('profiles').insert({ id, email: email ?? null });
        if (insertError) throw insertError;
      } else if (email) {
        // Après la conversion d'un compte anonyme : l'adresse rejoint le profil
        await supabase.from('profiles').update({ email }).eq('id', id).is('email', null);
      }
    } catch (e) {
      console.error('Error creating profile:', e);
    }
  };

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });
      return { error };
    } catch (e) {
      return { error: e };
    }
  };

  const signUp = async (email: string, password: string, captchaToken?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { captchaToken },
    });
    // Confirmation d'email active : le compte est créé mais sans session tant que le lien n'est pas ouvert
    return { error, needsEmailConfirmation: !error && !data.session };
  };

  const signInAnonymously = async (captchaToken?: string) => {
    const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
    return { error };
  };

  // L'adresse d'abord (le compte devient permanent), puis le mot de passe ; nouveau jeton sans is_anonymous
  const upgradeAccount = async (email: string, password: string) => {
    const { error: emailError } = await supabase.auth.updateUser({ email });
    if (emailError) return { error: emailError };
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) return { error: passwordError };
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.user) await ensureProfile(data.user.id, data.user.email);
    return { error };
  };

  const signOut = async () => {
    // Tant que la session existe : l'appareil ne recevra plus les résumés de ce compte
    await unregisterPush();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signInAnonymously, upgradeAccount, isAnonymous: user?.is_anonymous === true, signOut }}
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
