import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User as AppUser } from '@/types';
import { auth } from '@/services/auth';
import { db, storage } from '@/services/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  updateProfile as updateFirebaseProfile,
  updatePassword as updateFirebasePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs, query, where, writeBatch, increment, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { createCompanyRecords, type CompanySignup } from '@/services/signup';
import { acceptInviteRecords, getInvite } from '@/services/invites';
import { clearPendingSignup, getPendingSignup, savePendingSignup, type PendingSignup } from '@/services/pending';
import { isStaffRole } from '@/lib/subscription';
import type { Invite, OnboardResult } from '@/types';

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
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes, then try again.';
    case 'auth/network-request-failed':
    case 'unavailable':
      return 'Network problem. Check your connection and try again.';
    case 'permission-denied':
      return deniedMessage;
    default:
      return 'Something went wrong. Please try again.';
  }
};

const COMPANY_DENIED = 'We could not create your company. Please try again.';
const INVITE_DENIED =
  'This invite can no longer be used: it may have expired, or the company is full or read-only. Ask your admin for a new one.';

interface AuthContextType {
  user: AppUser | null;
  allUsers: (AppUser & { password?: string })[];
  login: (email: string, password: string) => Promise<{ success: boolean; errorCode?: string }>;
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
  /**
   * Self-serve sign-up: creates the login, then (once its email is confirmed)
   * the trial company and the admin profile. `resend` sends the confirmation
   * email again.
   */
  signUpCompany: (input: CompanySignup & { password: string }, resend?: boolean) => Promise<OnboardResult>;
  /** Creates the login for an invite and, once its email is confirmed, joins its company. */
  joinWithInvite: (invite: Invite, name: string, password: string, resend?: boolean) => Promise<OnboardResult>;
  /**
   * For a signed-in login with no company: finishes a sign-up or invite whose
   * email has since been confirmed. 'none' = nothing pending, 'unconfirmed' =
   * still waiting for the email link (`sendAgain` re-sends it).
   */
  finishPendingSignup: (sendAgain?: boolean) => Promise<true | 'none' | 'unconfirmed' | string>;
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

  // The signed-in user's workspace. Kept in a ref so refreshUsers/removeUser,
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

  // Staff see their company's people live, so someone who joins (or changes
  // their name) shows up without a reload. Clients keep reading only their
  // own profile (firestore.rules).
  const staffWorkspace = user && user.role !== 'client' ? user.workspaceId || '' : '';
  useEffect(() => {
    if (!staffWorkspace) return;
    return onSnapshot(
      query(collection(db, 'users'), where('workspaceId', '==', staffWorkspace)),
      snapshot => setAllUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AppUser[]),
      error => console.error('Error loading people:', error),
    );
  }, [staffWorkspace]);

  // Creates (or, after an earlier half-finished attempt, re-uses) the login.
  // Until its email is confirmed only `pending` is saved (what they typed, so
  // signing in after clicking the link finishes the job; see
  // finishPendingSignup): a confirmation email goes out (for a new login, or
  // when asked to resend) and the person is signed out again. Once confirmed,
  // writes the records and loads the session.
  const onboard = useCallback(async (
    email: string,
    password: string,
    displayName: string,
    writeRecords: (uid: string) => Promise<unknown>,
    deniedMessage: string,
    pending: PendingSignup,
    resend = false,
  ): Promise<OnboardResult> => {
    onboardingRef.current = true;
    try {
      let credential;
      let created = false;
      try {
        credential = await createUserWithEmailAndPassword(auth, email, password);
        created = true;
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
      if (!credential.user.emailVerified) {
        await savePendingSignup(credential.user.uid, pending);
        // The link leads to the home page, where signing in finishes the job.
        if (created || resend) {
          await sendEmailVerification(credential.user, { url: `${window.location.origin}/?confirmed=1` });
        }
        await signOut(auth);
        return { confirmEmail: email };
      }
      await writeRecords(credential.user.uid);
      await clearPendingSignup(credential.user.uid).catch(() => undefined);
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

  const signUpCompany = useCallback((input: CompanySignup & { password: string }, resend = false) =>
    onboard(input.email.trim().toLowerCase(), input.password, input.name.trim(),
      uid => createCompanyRecords(uid, input),
      COMPANY_DENIED,
      { kind: 'company', name: input.name.trim(), companyName: input.companyName.trim(), plan: input.plan, billingCycle: input.billingCycle },
      resend), [onboard]);

  const joinWithInvite = useCallback((invite: Invite, name: string, password: string, resend = false) =>
    onboard(invite.email, password, name.trim(),
      uid => acceptInviteRecords(uid, invite, name),
      INVITE_DENIED,
      { kind: 'invite', name: name.trim(), inviteId: invite.id },
      resend),
    [onboard]);

  // For a signed-in login with no company yet: if it signed up or accepted an
  // invite and has since confirmed its email, finish that now. 'none' when
  // there is nothing to finish, 'unconfirmed' when the email still needs
  // confirming (sendAgain re-sends the link), true when done, or a message.
  const finishPendingSignup = useCallback(async (sendAgain = false): Promise<true | 'none' | 'unconfirmed' | string> => {
    const current = auth.currentUser;
    if (!current) return 'none';
    onboardingRef.current = true;
    try {
      const pending = await getPendingSignup(current.uid);
      if (!pending) return 'none';
      // Pick up a confirmation made in another tab or on another device.
      await current.reload();
      if (!current.emailVerified) {
        if (sendAgain) await sendEmailVerification(current, { url: `${window.location.origin}/?confirmed=1` });
        return 'unconfirmed';
      }
      await current.getIdToken(true); // the rules read email_verified from the token
      const email = (current.email || '').toLowerCase();
      if (pending.kind === 'company') {
        await createCompanyRecords(current.uid, { ...pending, email });
      } else {
        const invite = await getInvite(pending.inviteId);
        if (!invite) return INVITE_DENIED;
        await acceptInviteRecords(current.uid, invite, pending.name);
      }
      await clearPendingSignup(current.uid).catch(() => undefined);
      setLoading(true);
      await applySession(current);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('Could not finish sign-up:', error);
      return onboardingError((error as { code?: string }).code, 'We could not finish setting up your account. Please try again.');
    } finally {
      onboardingRef.current = false;
    }
  }, [applySession]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; errorCode?: string }> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error: unknown) {
      console.error('Login error:', error);
      return { success: false, errorCode: (error as { code?: string })?.code || 'auth/unknown' };
    }
  }, []);

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
      joinWithInvite,
      finishPendingSignup
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
