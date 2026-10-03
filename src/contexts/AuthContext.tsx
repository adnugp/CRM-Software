import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User as AppUser, UserRole, Workspace } from '@/types';
import { auth } from '@/services/auth';
import { db, storage } from '@/services/firebase';
import { callApi, setApiWorkspace } from '@/services/api';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile as updateFirebaseProfile, updatePassword as updateFirebasePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface AuthContextType {
  user: AppUser | null;
  allUsers: AppUser[];
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  error: string | null;
  login: (email: string, password: string) => Promise<{success: boolean; errorCode?: string}>;
  register: (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string) => Promise<boolean>;
  addUser: (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string) => Promise<string | true>;
  removeUser: (id: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  selectWorkspace: (id: string) => void;
  isAuthenticated: boolean;
  loading: boolean;
  updateProfile: (name: string, email: string) => Promise<boolean>;
  updateAvatar: (file: File) => Promise<string | null>;
  updatePassword: (current: string, next: string) => Promise<boolean>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
const message = (e: unknown) => e instanceof Error ? e.message : 'Unable to complete this request.';

export const AuthProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(sessionStorage.getItem('crm-workspace'));
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeWorkspace = workspaces.find(w => w.id === selectedId) || null;

  const selectWorkspace = useCallback((id: string) => {
    sessionStorage.setItem('crm-workspace', id);
    setApiWorkspace(id);
    setAllUsers([]);
    setSelectedId(id);
  }, []);
  const refreshWorkspaces = useCallback(async () => {
    if (!auth.currentUser) return;
    const requestUid=auth.currentUser.uid;
    const result = await callApi<{workspaces: Workspace[]}>('workspaceList', {});
    if(auth.currentUser?.uid!==requestUid)return;
    setError(null);
    setWorkspaces(result.workspaces);
    const saved = sessionStorage.getItem('crm-workspace');
    const id = result.workspaces.find(w => w.id === saved)?.id || result.workspaces[0]?.id || null;
    setSelectedId(id);
    setApiWorkspace(id);
    if (id) sessionStorage.setItem('crm-workspace', id);
    else sessionStorage.removeItem('crm-workspace');
  }, []);
  const refreshUsers = useCallback(async () => {
    if (!activeWorkspace || !auth.currentUser) { setAllUsers([]); return; }
    const requestUid=auth.currentUser.uid;const requestWorkspace=activeWorkspace.id;
    const result = await callApi<{members: AppUser[]}>('workspaceMembers', {workspaceId: requestWorkspace});
    if(auth.currentUser?.uid!==requestUid||sessionStorage.getItem('crm-workspace')!==requestWorkspace)return;
    setAllUsers(result.members.filter(member=>(member as AppUser & {active?:boolean}).active !== false));
  }, [activeWorkspace]);

  useEffect(() => {
    let epoch = 0;
    const unsubscribe = onAuthStateChanged(auth, async current => {
      const run = ++epoch;
      setLoading(true); setError(null); setAllUsers([]); setWorkspaces([]); setApiWorkspace(null);
      if (!current) { setUser(null); setLoading(false); return; }
      try {
        const snapshot = await getDoc(doc(db, 'users', current.uid));
        if (run !== epoch) return;
        const profile = snapshot.exists() ? snapshot.data() : {};
        // An identity without membership can only onboard; it has no workspace permissions.
        setUser({id: current.uid, name: profile.name || current.displayName || 'User', email: current.email || '', role: 'user', avatar: profile.avatar});
        await refreshWorkspaces();
      } catch (e) { if (run === epoch) setError(message(e)); }
      finally { if (run === epoch) setLoading(false); }
    });
    return () => { epoch++; unsubscribe(); };
  }, [refreshWorkspaces]);
  useEffect(() => {
    setApiWorkspace(activeWorkspace?.id || null);
    setUser(previous => previous ? {...previous, role: activeWorkspace?.role || 'user', workspaceId: activeWorkspace?.id} : null);
    refreshUsers().catch(e => setError(message(e)));
  }, [activeWorkspace, refreshUsers]);
  useEffect(() => {
    if (!auth.currentUser) return;
    const timer = setInterval(() => refreshWorkspaces().catch(e => {
      setApiWorkspace(null); setWorkspaces([]); setAllUsers([]); setError(message(e));
    }), 60_000);
    return () => clearInterval(timer);
  }, [refreshWorkspaces]);

  const login = async (email: string, password: string) => {
    try { await signInWithEmailAndPassword(auth, email, password); return {success: true}; }
    catch (e) { return {success: false, errorCode: (e as {code?: string}).code || 'auth/unknown'}; }
  };
  const register = async (name: string, email: string, password: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateFirebaseProfile(result.user, {displayName: name});
      await setDoc(doc(db, 'users', result.user.uid), {name});
      return true;
    } catch (e) { setError(message(e)); return false; }
  };
  const addUser = async (name: string, email: string, password: string, role: UserRole, company?: string, organizationId?: string): Promise<string | true> => {
    if (!activeWorkspace) return 'Select a workspace first.';
    try {
      await callApi('workspaceInvite', {workspaceId: activeWorkspace.id,name,email,password,role,company,organizationId});
      await refreshUsers(); return true;
    } catch (e) { return message(e); }
  };
  const removeUser = async (id: string) => {
    if (!activeWorkspace) return false;
    try { await callApi('workspaceRevoke',{workspaceId:activeWorkspace.id,userId:id}); await refreshUsers(); return true; }
    catch (e) { setError(message(e)); return false; }
  };
  const logout = async () => { setApiWorkspace(null); sessionStorage.removeItem('crm-workspace'); await signOut(auth); };
  const updateProfile = async (name: string, email: string) => {
    if (!auth.currentUser) return false;
    try {
      if (email !== auth.currentUser.email) await updateEmail(auth.currentUser,email);
      await updateFirebaseProfile(auth.currentUser,{displayName:name});
      await setDoc(doc(db,'users',auth.currentUser.uid),{name},{merge:true});
      setUser(previous => previous ? {...previous,name,email} : null); return true;
    } catch (e) { setError(message(e)); return false; }
  };
  const updateAvatar = async (file: File) => {
    if (!auth.currentUser || !['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 2*1024*1024) return null;
    try {
      const object = ref(storage,`users/${auth.currentUser.uid}/avatars/${crypto.randomUUID()}`);
      await uploadBytes(object,file);
      const avatar = await getDownloadURL(object);
      await setDoc(doc(db,'users',auth.currentUser.uid),{avatar},{merge:true});
      setUser(previous => previous ? {...previous,avatar} : null); return avatar;
    } catch (e) { setError(message(e)); return null; }
  };
  const updatePassword = async (current: string, next: string) => {
    if (!auth.currentUser?.email) return false;
    try {
      await reauthenticateWithCredential(auth.currentUser,EmailAuthProvider.credential(auth.currentUser.email,current));
      await updateFirebasePassword(auth.currentUser,next); return true;
    } catch (e) { setError(message(e)); return false; }
  };
  return <AuthContext.Provider value={{user,allUsers,workspaces,activeWorkspace,error,login,register,addUser,removeUser,logout,refreshUsers,refreshWorkspaces,selectWorkspace,isAuthenticated:!!user,loading,updateProfile,updateAvatar,updatePassword}}>{children}</AuthContext.Provider>;
};
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
