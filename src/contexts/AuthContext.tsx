import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users storage - in a real app this would be a database
const getStoredUsers = (): Record<string, { password: string; user: User }> => {
  const stored = localStorage.getItem('crm_users');
  if (stored) {
    return JSON.parse(stored);
  }
  // Default users
  return {
    'admin@crm.com': {
      password: 'admin123',
      user: {
        id: '1',
        email: 'admin@crm.com',
        name: 'Admin User',
        role: 'admin',
      },
    },
    'user@crm.com': {
      password: 'user123',
      user: {
        id: '2',
        email: 'user@crm.com',
        name: 'John Doe',
        role: 'user',
      },
    },
    'jane@techcorp.com': {
      password: 'client123',
      user: {
        id: '3',
        email: 'jane@techcorp.com',
        name: 'Jane Smith',
        role: 'client',
        company: 'TechCorp',
      },
    },
  };
};

const saveUsers = (users: Record<string, { password: string; user: User }>) => {
  localStorage.setItem('crm_users', JSON.stringify(users));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('crm_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    const users = getStoredUsers();
    const userData = users[email.toLowerCase()];
    if (userData && userData.password === password) {
      setUser(userData.user);
      localStorage.setItem('crm_user', JSON.stringify(userData.user));
      return true;
    }
    return false;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: UserRole): Promise<boolean> => {
    const users = getStoredUsers();
    const emailLower = email.toLowerCase();
    
    // Check if email already exists
    if (users[emailLower]) {
      return false;
    }

    const newUser: User = {
      id: Date.now().toString(),
      email: emailLower,
      name,
      role,
    };

    users[emailLower] = {
      password,
      user: newUser,
    };

    saveUsers(users);
    setUser(newUser);
    localStorage.setItem('crm_user', JSON.stringify(newUser));
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('crm_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
