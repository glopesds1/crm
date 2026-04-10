import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { UserSession } from '../types';

export function useSession() {
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Checar sessão Supabase Auth ao montar
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const saved = localStorage.getItem('hubm2black_session');
        if (saved) {
          try { setUserSession(JSON.parse(saved)); } catch {}
        }
      }
      setIsLoading(false);
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserSession(null);
        localStorage.removeItem('hubm2black_session');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Persist UserSession no localStorage (dados de UI, não de auth)
  useEffect(() => {
    if (userSession) localStorage.setItem('hubm2black_session', JSON.stringify(userSession));
    else localStorage.removeItem('hubm2black_session');
  }, [userSession]);

  const login = (session: UserSession) => setUserSession(session);

  const logout = async () => {
    const { signOut } = await import('../lib/database');
    await signOut();
    setUserSession(null);
  };

  return { session: userSession, isLoading, login, logout };
}
