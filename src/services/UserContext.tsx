import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService, User } from './AuthService';

interface UserContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkAccess: () => Promise<boolean>;
  updateSubscription: (months: number) => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const user = await authService.signIn(email, password);
      setUser(user);
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const user = await authService.signUp(email, password);
      setUser(user);
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await authService.signOut();
      setUser(null);
    } catch (error) {
      throw error;
    }
  };

  const checkAccess = async () => {
    if (!user) return false;
    return authService.checkAccess(user.uid);
  };

  const updateSubscription = async (months: number) => {
    if (!user) throw new Error('No user logged in');
    await authService.updateSubscription(user.uid, months);
    const updatedUser = await authService.getCurrentUser();
    setUser(updatedUser);
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    checkAccess,
    updateSubscription,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
