import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<boolean>;
  addUser: (name: string, email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Local storage keys
const MOCK_USERS_KEY = 'crm_mock_users';
const CURRENT_USER_KEY = 'crm_current_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize from local storage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Error parsing saved user', e);
        localStorage.removeItem(CURRENT_USER_KEY);
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('Attempting login with email (Local Storage):', email);

      // Check registered mock users in local storage
      const mockUsersJson = localStorage.getItem(MOCK_USERS_KEY);
      if (mockUsersJson) {
        const mockUsers = JSON.parse(mockUsersJson);
        const foundUser = mockUsers.find((u: any) => u.email === email && u.password === password);
        if (foundUser) {
          const userProfile: User = {
            id: foundUser.id,
            email: foundUser.email,
            name: foundUser.name,
            role: foundUser.role,
          };
          setUser(userProfile);
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userProfile));
          console.log('Login successful:', userProfile.name);
          return true;
        }
      }

      // Default admin account for testing
      if (email === 'admin@admin.com' && password === 'admin123') {
        const adminUser: User = {
          id: 'admin-id',
          email: 'admin@admin.com',
          name: 'Admin User',
          role: 'admin',
        };
        setUser(adminUser);
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(adminUser));
        console.log('Login successful (admin default)');
        return true;
      }

      console.warn('Login failed: invalid credentials');
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: UserRole): Promise<boolean> => {
    try {
      console.log('Attempting registration (Local Storage) for:', email);

      const mockUsersJson = localStorage.getItem(MOCK_USERS_KEY);
      const mockUsers = mockUsersJson ? JSON.parse(mockUsersJson) : [];

      // Check if email already exists locally
      if (mockUsers.some((u: any) => u.email === email)) {
        console.warn('Registration failed: email already exists');
        return false;
      }

      const newUserId = `user-${Date.now()}`;
      const userProfile: User = {
        id: newUserId,
        email: email,
        name: name,
        role: role,
      };

      // Save to local mock users list (with password for future login)
      mockUsers.push({ ...userProfile, password });
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(mockUsers));

      // Set current session
      setUser(userProfile);
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(userProfile));
      console.log('Registration successful:', userProfile.name);
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  }, []);

  const addUser = useCallback(async (name: string, email: string, password: string, role: UserRole): Promise<boolean> => {
    try {
      console.log('Attempting to add user (Local Storage) for:', email);

      const mockUsersJson = localStorage.getItem(MOCK_USERS_KEY);
      const mockUsers = mockUsersJson ? JSON.parse(mockUsersJson) : [];

      // Check if email already exists locally
      if (mockUsers.some((u: any) => u.email === email)) {
        console.warn('Add user failed: email already exists');
        return false;
      }

      const newUserId = `user-${Date.now()}`;
      const userProfile: User = {
        id: newUserId,
        email: email,
        name: name,
        role: role,
      };

      // Save to local mock users list (with password for future login)
      mockUsers.push({ ...userProfile, password });
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(mockUsers));

      console.log('User added successfully:', userProfile.name);
      return true;
    } catch (error) {
      console.error('Add user error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    console.log('Logging out...');
    setUser(null);
    localStorage.removeItem(CURRENT_USER_KEY);
    console.log('Logout successful');
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
      addUser,
      logout,
      isAuthenticated: !!user,
      loading
    }}>
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
