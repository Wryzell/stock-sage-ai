import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, UserRole } from '@/types';
import { mockUsers } from '@/data/mockData';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string, role: UserRole): Promise<boolean> => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Demo credentials check
    if (role === 'super_admin' && email === 'admin@demo.com' && password === 'demo123') {
      const adminUser = mockUsers.find(u => u.role === 'super_admin');
      if (adminUser) {
        setUser({ ...adminUser, lastLogin: new Date().toISOString() });
        setIsLoading(false);
        return true;
      }
    }
    
    if (role === 'staff' && email === 'staff@demo.com' && password === 'staff123') {
      const staffUser = mockUsers.find(u => u.role === 'staff');
      if (staffUser) {
        setUser({ ...staffUser, lastLogin: new Date().toISOString() });
        setIsLoading(false);
        return true;
      }
    }
    
    setIsLoading(false);
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, isLoading }}>
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
