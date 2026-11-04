import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User as AppUser, UserRole } from '@/types';
import { auth } from '@/services/auth';
import { db, storage, firebaseConfig } from '@/services/firebase';
import { initializeApp, getApps } from 'firebase/app';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  updatePassword as updateFirebasePassword,
  getAuth,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface AuthContextType {
  user: AppUser | null;
  allUsers: (AppUser & { password?: string })[];
  login: (email: string, password: string) => Promise<{ success: boolean; errorCode?: string }>;
  register: (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string) => Promise<boolean>;
  addUser: (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string) => Promise<string | true>;
  removeUser: (id: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  updateProfile: (name: string, email: string) => Promise<boolean>;
  updateAvatar: (file: File) => Promise<string | null>;
  updatePassword: (current: string, newP: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

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
        // No profile document means the account was never registered through the
        // admin portal (or was removed). Firestore rules grant such accounts no
        // access, so fall back to the least-privileged role.
        const profile: AppUser = userData || {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          role: 'client'
        };
        setUser(profile);

        if (profile.role === 'client') {
          // Clients may only read their own profile (see firestore.rules).
          setAllUsers([profile]);
        } else {
          await refreshUsers();
        }
      } else {
        setUser(null);
        setAllUsers([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [refreshUsers]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; errorCode?: string }> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error: unknown) {
      console.error('Login error:', error);
      return { success: false, errorCode: (error as { code?: string })?.code || 'auth/unknown' };
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
      const cleanUserData = Object.fromEntries(
        Object.entries(newUserData).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'users', uid), cleanUserData);
      await refreshUsers();

      const completeUser = { id: uid, ...newUserData };
      setUser(completeUser);
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  }, [refreshUsers]);

  const getSecondaryApp = () => {
    const existingApp = getApps().find((appInstance) => appInstance.name === 'secondary');
    if (existingApp) {
      return existingApp;
    }
    return initializeApp(firebaseConfig, 'secondary');
  };

  const addUser = useCallback(async (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string): Promise<string | true> => {
    // Use a separate Firebase app instance for user creation so the current
    // authenticated admin session is not replaced by the newly created user.
    try {
      const secondaryApp = getSecondaryApp();
      const secondaryAuth = getAuth(secondaryApp);

      const newUserCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = newUserCredential.user.uid;

      const newUserData: Omit<AppUser, 'id'> = {
        email,
        name,
        role,
        company,
        organizationId,
      };

      const cleanUserData = Object.fromEntries(
        Object.entries(newUserData).filter(([_, v]) => v !== undefined)
      );
      await setDoc(doc(db, 'users', newUid), cleanUserData);
      await signOut(secondaryAuth);
      await refreshUsers();
      return true;
    } catch (error: unknown) {
      console.error('Add user error:', error);
      const code = (error as { code?: string })?.code;
      if (code === 'auth/email-already-in-use') {
        return 'Email already registered';
      }
      if (code === 'auth/weak-password') {
        return 'Password should be at least 6 characters';
      }
      if (code === 'auth/invalid-email') {
        return 'Invalid email address';
      }
      return 'Registration failed. Please try again.';
    }
  }, [refreshUsers]);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      console.log('Session expired due to inactivity');
      logout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [logout]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handleActivity = () => resetInactivityTimer();
    events.forEach(event => window.addEventListener(event, handleActivity));
    resetInactivityTimer();
    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [resetInactivityTimer]);

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

  const updateAvatar = useCallback(async (file: File): Promise<string | null> => {
    try {
      if (!user || !auth.currentUser) return null;

      const uniqueFileName = `avatars/${user.id}_${Date.now()}_${file.name}`;
      const storageRef = ref(storage, uniqueFileName);
      const uploadTask = uploadBytesResumable(storageRef, file);

      const downloadURL = await new Promise<string>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          null,
          (error) => {
            console.error('Avatar upload error:', error);
            reject(error);
          },
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(url);
            } catch (urlError) {
              reject(urlError);
            }
          }
        );
      });

      await setDoc(doc(db, 'users', user.id), { avatar: downloadURL }, { merge: true });
      setUser(prev => prev ? { ...prev, avatar: downloadURL } : null);
      await refreshUsers();
      return downloadURL;
    } catch (e) {
      console.error('Update avatar error:', e);
      return null;
    }
  }, [user, refreshUsers]);

  const updatePassword = useCallback(async (current: string, newP: string): Promise<boolean> => {
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser?.email) return false;
      // Verify the current password first. This stops someone at an unlocked
      // session from changing the password, and satisfies Firebase's
      // "requires recent login" check for sensitive operations.
      const credential = EmailAuthProvider.credential(firebaseUser.email, current);
      await reauthenticateWithCredential(firebaseUser, credential);
      await updateFirebasePassword(firebaseUser, newP);
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
      updateAvatar,
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
