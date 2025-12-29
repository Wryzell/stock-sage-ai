import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'super_admin' | 'staff';

interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  avatarUrl?: string;
  lastLogin?: string;
  status?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, fullName: string, role: AppRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error || !data) return null;
    return data.role as AppRole;
  };

  const fetchUserProfile = async (userId: string): Promise<{ fullName: string; avatarUrl?: string } | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    
    if (error || !data) return null;
    return { fullName: data.full_name || '', avatarUrl: data.avatar_url || undefined };
  };

  const buildAuthUser = async (supabaseUser: User): Promise<AuthUser | null> => {
    const [role, profile] = await Promise.all([
      fetchUserRole(supabaseUser.id),
      fetchUserProfile(supabaseUser.id)
    ]);

    if (!role) return null;

    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      fullName: profile?.fullName || supabaseUser.email?.split('@')[0] || '',
      role,
      avatarUrl: profile?.avatarUrl,
      lastLogin: new Date().toISOString(),
      status: 'active'
    };
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        setSession(currentSession);
        
        if (currentSession?.user) {
          // Defer Supabase calls with setTimeout to avoid deadlock
          setTimeout(async () => {
            const authUser = await buildAuthUser(currentSession.user);
            setUser(authUser);
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      if (currentSession?.user) {
        buildAuthUser(currentSession.user).then(authUser => {
          setUser(authUser);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }

    if (data.user) {
      const authUser = await buildAuthUser(data.user);
      if (!authUser) {
        setIsLoading(false);
        return { success: false, error: 'User role not found. Please contact administrator.' };
      }
      setUser(authUser);
    }

    setIsLoading(false);
    return { success: true };
  }, []);

  const signup = useCallback(async (
    email: string, 
    password: string, 
    fullName: string, 
    role: AppRole
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role
        }
      }
    });

    if (error) {
      setIsLoading(false);
      return { success: false, error: error.message };
    }

    if (data.user && !data.session) {
      setIsLoading(false);
      return { success: true, error: 'Please check your email to confirm your account.' };
    }

    setIsLoading(false);
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      session,
      isAuthenticated: !!user, 
      login, 
      signup,
      logout, 
      isLoading 
    }}>
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
