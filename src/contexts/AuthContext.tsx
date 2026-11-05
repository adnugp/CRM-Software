import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User as AppUser, UserRole } from '@/types';
import { auth, connectAuthIfEmulated } from '@/services/auth';
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
import { doc, getDoc, setDoc, collection, getDocs, query, where, writeBatch, increment } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { createCompanyRecords, type CompanySignup } from '@/services/signup';
import { acceptInviteRecords } from '@/services/invites';
import { isStaffRole } from '@/lib/subscription';
import type { Invite } from '@/types';

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

// Messages for sign-up / invite-accept failures.
const onboardingError = (code: string | undefined, deniedMessage: string): string => {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'This email already has an account. Sign in instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Network problem. Check your connection and try again.';
    case 'permission-denied':
      return deniedMessage;
    default:
      return 'Something went wrong. Please try again.';
  }
};

interface AuthContextType {
  user: AppUser | null;
  allUsers: (AppUser & { password?: string })[];
  login: (email: string, password: string) => Promise<{ success: boolean; errorCode?: string }>;
  addUser: (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string) => Promise<string | true>;
  removeUser: (id: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  updateProfile: (name: string, email: string) => Promise<boolean>;
  updateAvatar: (file: File) => Promise<string | null>;
  updatePassword: (current: string, newP: string) => Promise<boolean>;
  /** True for the product owner (super admin): /platformOwners/{uid} exists. */
  isOwner: boolean;
  /** Self-serve sign-up: creates the login, the trial company and the admin profile. */
  signUpCompany: (input: CompanySignup & { password: string }) => Promise<true | string>;
  /** Creates the login for an invite and joins its company. */
  joinWithInvite: (invite: Invite, name: string, password: string) => Promise<true | string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [allUsers, setAllUsers] = useState<(AppUser & { password?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  // True while sign-up / invite-accept runs: the login exists a moment before
  // its profile, so the auth listener leaves the session to onboard().
  const onboardingRef = useRef(false);

  // The signed-in user's workspace. Kept in a ref so refreshUsers/addUser,
  // which are called from many places, always use the current one.
  const workspaceIdRef = useRef('');

  // Staff see the people in their own company only; firestore.rules reject a
  // users query that isn't filtered by the caller's workspace.
  const refreshUsers = useCallback(async () => {
    const workspaceId = workspaceIdRef.current;
    if (!workspaceId) {
      setAllUsers([]);
      return;
    }
    try {
      const usersSnapshot = await getDocs(query(collection(db, 'users'), where('workspaceId', '==', workspaceId)));
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppUser[];
      setAllUsers(usersList);
    } catch (error) {
      console.error('Error refreshing users:', error);
    }
  }, []);

  // Loads profile, owner flag and colleagues for a signed-in login.
  const applySession = useCallback(async (firebaseUser: FirebaseUser | null) => {
    if (!firebaseUser) {
      workspaceIdRef.current = '';
      setUser(null);
      setAllUsers([]);
      setIsOwner(false);
      return;
    }
    const userData = await fetchUserData(firebaseUser.uid);
    // No profile document means the account never joined a company (or was
    // removed). Firestore rules grant such accounts no access, so fall back to
    // the least-privileged role.
    const profile: AppUser = userData || {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      role: 'client'
    };
    workspaceIdRef.current = profile.workspaceId || '';
    const owner = await getDoc(doc(db, 'platformOwners', firebaseUser.uid))
      .then(snapshot => snapshot.exists())
      .catch(() => false);
    setIsOwner(owner);
    setUser(profile);
    if (profile.role === 'client' || !profile.workspaceId) {
      // Clients may only read their own profile (see firestore.rules).
      setAllUsers([profile]);
    } else {
      await refreshUsers();
    }
  }, [refreshUsers]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (onboardingRef.current) return;
      setLoading(true);
      await applySession(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [applySession]);

  // Creates (or, after an earlier half-finished attempt, re-uses) the login,
  // writes the records, then loads the session. Returns true or an error message.
  const onboard = useCallback(async (
    email: string,
    password: string,
    displayName: string,
    writeRecords: (uid: string) => Promise<unknown>,
    deniedMessage: string,
  ): Promise<true | string> => {
    onboardingRef.current = true;
    try {
      let credential;
      try {
        credential = await createUserWithEmailAndPassword(auth, email, password);
      } catch (error) {
        if ((error as { code?: string }).code !== 'auth/email-already-in-use') throw error;
        // An earlier attempt may have created the login but not the profile: finish it.
        credential = await signInWithEmailAndPassword(auth, email, password);
        if (await fetchUserData(credential.user.uid)) {
          await signOut(auth);
          return 'This email already has an account. Sign in instead.';
        }
      }
      await updateFirebaseProfile(credential.user, { displayName }).catch(() => undefined);
      await writeRecords(credential.user.uid);
      await applySession(credential.user);
      return true;
    } catch (error) {
      console.error('Onboarding error:', error);
      if (auth.currentUser) await signOut(auth).catch(() => undefined);
      return onboardingError((error as { code?: string }).code, deniedMessage);
    } finally {
      onboardingRef.current = false;
    }
  }, [applySession]);

  const signUpCompany = useCallback((input: CompanySignup & { password: string }) =>
    onboard(input.email.trim().toLowerCase(), input.password, input.name.trim(),
      uid => createCompanyRecords(uid, input),
      'We could not create your company. Please try again.'), [onboard]);

  const joinWithInvite = useCallback((invite: Invite, name: string, password: string) =>
    onboard(invite.email, password, name.trim(),
      uid => acceptInviteRecords(uid, invite, name),
      'This invite can no longer be used: it may have expired, or the company is full or read-only. Ask your admin for a new one.'),
    [onboard]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; errorCode?: string }> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error: unknown) {
      console.error('Login error:', error);
      return { success: false, errorCode: (error as { code?: string })?.code || 'auth/unknown' };
    }
  }, []);

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
    // New people always join the admin's own workspace.
    const workspaceId = workspaceIdRef.current;
    if (!workspaceId) return 'Your account is not linked to a company.';

    try {
      const secondaryApp = getSecondaryApp();
      const secondaryAuth = getAuth(secondaryApp);
      connectAuthIfEmulated(secondaryAuth);

      const newUserCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUid = newUserCredential.user.uid;

      const newUserData: Omit<AppUser, 'id'> = {
        email,
        name,
        role,
        company,
        organizationId,
        workspaceId,
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
      // Deletes the profile, which revokes all data access. The Auth login
      // itself needs the Admin SDK to delete (see TODO.md).
      const target = allUsers.find(u => u.id === id);
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', id));
      // Staff free one place on the plan (firestore.rules: removing staff).
      if (target && isStaffRole(target.role)) {
        batch.update(doc(db, 'workspaces', workspaceIdRef.current), { staffCount: increment(-1), removedUid: id });
      }
      await batch.commit();
      await refreshUsers();

      if (user?.id === id) {
        await logout();
      }
      return true;
    } catch (error) {
      console.error('Remove user error:', error);
      return false;
    }
  }, [allUsers, refreshUsers, user, logout]);

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
      addUser,
      removeUser,
      logout,
      refreshUsers,
      isAuthenticated: !!user,
      loading,
      updateProfile,
      updateAvatar,
      updatePassword,
      isOwner,
      signUpCompany,
      joinWithInvite
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
