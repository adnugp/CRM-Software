import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth } from '@/services/auth';
import { db } from '@/services/firebase';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // Get user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const userProfile: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            name: userData.name || firebaseUser.displayName || '',
            role: userData.role || 'user',
            company: userData.company,
          };
          setUser(userProfile);
        } else {
          // Create user profile if it doesn't exist
          const userProfile: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            name: firebaseUser.displayName || '',
            role: 'user',
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            name: userProfile.name,
            email: userProfile.email,
            role: userProfile.role,
            createdAt: new Date(),
          });
          setUser(userProfile);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: UserRole): Promise<boolean> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);

      // Update Firebase Auth profile
      await updateProfile(userCredential.user, {
        displayName: name,
      });

      // Create user document in Firestore
      const userProfile: User = {
        id: userCredential.user.uid,
        email: email,
        name: name,
        role: role,
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: name,
        email: email,
        role: role,
        createdAt: new Date(),
      });

      setUser(userProfile);
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      login,
      register,
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
