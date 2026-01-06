import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'admin' | 'staff';

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

  const fetchUserProfile = async (userId: string): Promise<{ fullName: string; role: AppRole } | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    
    if (!data) return null;
    
    return { 
      fullName: data.full_name || '', 
      role: (data.role as AppRole) || 'staff'
    };
  };

  const buildAuthUser = async (supabaseUser: User): Promise<AuthUser | null> => {
    const profile = await fetchUserProfile(supabaseUser.id);

    // If no profile, use metadata from signup or default to staff
    const role = profile?.role || 
                 (supabaseUser.user_metadata?.role as AppRole) || 
                 'staff';
    
    const fullName = profile?.fullName || 
                     supabaseUser.user_metadata?.full_name || 
                     supabaseUser.email?.split('@')[0] || '';

    return {
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      fullName,
      role,
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
