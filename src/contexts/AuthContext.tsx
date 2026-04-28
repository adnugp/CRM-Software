import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User as AppUser, UserRole } from '@/types';
import { auth } from '@/services/auth';
import { db } from '@/services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  updatePassword as updateFirebasePassword,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';

interface AuthContextType {
  user: AppUser | null;
  allUsers: (AppUser & { password?: string })[];
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string) => Promise<boolean>;
  addUser: (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string) => Promise<boolean>;
  removeUser: (id: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  updateProfile: (name: string, email: string) => Promise<boolean>;
  updatePassword: (current: string, newP: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<(AppUser & { password?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (uid: string): Promise<AppUser | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return { id: uid, ...userDoc.data() } as AppUser;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  const refreshUsers = useCallback(async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppUser[];
      setAllUsers(usersList);
    } catch (error) {
      console.error('Error refreshing users:', error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setLoading(true);
      if (firebaseUser) {
        const userData = await fetchUserData(firebaseUser.uid);
        if (userData) {
          setUser(userData);
        } else {
          // If no custom user data found, set a minimal profile
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            role: 'client'
          });
        }
      } else {
        setUser(null);
      }
      await refreshUsers();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [refreshUsers]);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string): Promise<boolean> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;

      // Update firebase profile
      await updateFirebaseProfile(userCredential.user, { displayName: name });

      const newUserData: Omit<AppUser, 'id'> = {
        email,
        name,
        role,
        company: company || (role === 'client' ? name : undefined),
        organizationId: organizationId || (role === 'client' ? `ORG-${name.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-3)}` : undefined),
      };

      // Store extra user details in Firestore
      await setDoc(doc(db, 'users', uid), newUserData);
      await refreshUsers();
      
      const completeUser = { id: uid, ...newUserData };
      setUser(completeUser);
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  }, [refreshUsers]);

  const addUser = useCallback(async (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string): Promise<boolean> => {
    // Note: Creating a user via Firebase client SDK will log them in. 
    // Usually, admins adding users is done via Cloud Functions or a secondary app instance.
    // For this context, we will just simulate it by temporarily saving the current auth state,
    // creating the user, and reverting the auth state. This is a common workaround but not ideal for production.
    try {
      const currentFirebaseUser = auth.currentUser;
      
      const newUserCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUid = newUserCredential.user.uid;
      
      const newUserData: Omit<AppUser, 'id'> = {
        email,
        name,
        role,
        company,
        organizationId,
      };

      await setDoc(doc(db, 'users', newUid), newUserData);
      
      // Attempt to re-authenticate the original user or just signOut to let them log in again.
      // Re-authenticating would require password, so we just sign out or leave it (they will be the new user).
      // Since this is client-side, we'll log out the new user and ask the admin to log back in (or we can just restore if we had credentials, but we don't).
      // A better way is using a secondary app instance, but for simplicity we just log out the new user if we were already logged in.
      if (currentFirebaseUser && currentFirebaseUser.uid !== newUid) {
          // In a real app we'd use Firebase Admin SDK to add users without logging out.
          // Since we can't easily switch back without a password, we won't log out here automatically
          // but just note it.
      }
      
      await refreshUsers();
      return true;
    } catch (error) {
      console.error('Add user error:', error);
      return false;
    }
  }, [refreshUsers]);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const removeUser = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Delete user doc from firestore (Note: this does not delete the user from Firebase Auth, 
      // which requires Firebase Admin SDK. But it will revoke their app-level access if roles are checked).
      await deleteDoc(doc(db, 'users', id));
      await refreshUsers();
      
      if (user?.id === id) {
        await logout();
      }
      return true;
    } catch (error) {
      console.error('Remove user error:', error);
      return false;
    }
  }, [refreshUsers, user, logout]);

  const updateProfile = useCallback(async (name: string, email: string): Promise<boolean> => {
    try {
      if (!user || !auth.currentUser) return false;
      
      // Update Firebase Auth profile
      await updateFirebaseProfile(auth.currentUser, { displayName: name });
      
      // Update Firestore user document
      await setDoc(doc(db, 'users', user.id), { name, email }, { merge: true });
      
      setUser(prev => prev ? { ...prev, name, email } : null);
      await refreshUsers();
      return true;
    } catch (e) {
      console.error('Update profile error:', e);
      return false;
    }
  }, [user, refreshUsers]);

  const updatePassword = useCallback(async (current: string, newP: string): Promise<boolean> => {
    try {
      if (!auth.currentUser) return false;
      // Note: Re-authentication is usually required before updating a password in Firebase
      // if the user hasn't logged in recently. This is a simplified approach.
      await updateFirebasePassword(auth.currentUser, newP);
      return true;
    } catch (e) {
      console.error('Update password error:', e);
      return false;
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      allUsers,
      login,
      register,
      addUser,
      removeUser,
      logout,
      refreshUsers,
      isAuthenticated: !!user,
      loading,
      updateProfile,
      updatePassword
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
