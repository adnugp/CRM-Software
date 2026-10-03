import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { callApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Workspace } from '@/types';

export default function Workspaces() {
  const {user,workspaces,activeWorkspace,selectWorkspace,refreshWorkspaces,logout,register,error:authError} = useAuth();
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [currency,setCurrency] = useState('AED');
  const [timezone,setTimezone] = useState('Asia/Dubai');
  const [divisions,setDivisions] = useState('Grow Plus Technologies, Sadeem Energy');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [done,setDone] = useState(false);
  if (done && activeWorkspace) return <Navigate to="/" replace/>;
  async function create(e:React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!user && !(await register(name,email,password,'user'))) throw new Error('Unable to create account. Check your email/password and try again.');
      const result = await callApi<{workspaceId:string}>('workspaceBootstrap',{name,currency,timezone,divisions:divisions.split(',').map(value=>value.trim()).filter(Boolean)});
      await refreshWorkspaces(); selectWorkspace(result.workspaceId); setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create workspace'); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-background p-6"><div className="max-w-4xl mx-auto space-y-8">
    <header className="flex justify-between items-center border-b pb-6"><div><p className="text-xs uppercase tracking-widest text-muted-foreground">Tender and project operations</p><h1 className="text-3xl font-semibold mt-2">Your workspaces</h1></div>{user ? <Button variant="outline" onClick={()=>logout()}>Sign out</Button> : <Link to="/login">Sign in</Link>}</header>
    {import.meta.env.VITE_USE_EMULATORS==='true'&&<p className="text-sm text-muted-foreground">Local development: accounts and workspace data are stored on this computer.</p>}
    {(error || authError) && <p role="alert" className="border border-destructive text-destructive rounded p-4">{error || authError}</p>}
    {workspaces.length > 0 && <section className="grid md:grid-cols-2 gap-4">{workspaces.map((workspace:Workspace)=><Card key={workspace.id}><CardHeader><CardTitle>{workspace.name}</CardTitle></CardHeader><CardContent><p className="text-muted-foreground mb-4">{workspace.role} · {workspace.currency} · {workspace.timezone}</p><Button onClick={()=>{selectWorkspace(workspace.id);setDone(true);}}>Open workspace</Button></CardContent></Card>)}</section>}
    <Card><CardHeader><CardTitle>Create a workspace</CardTitle><p className="text-sm text-muted-foreground">Keep your team, customers, and records together in a private workspace.</p></CardHeader><CardContent><form onSubmit={create} className="grid md:grid-cols-2 gap-5">
      <div className="md:col-span-2"><Label htmlFor="workspace-name">Business name</Label><Input id="workspace-name" required value={name} onChange={e=>setName(e.target.value)}/></div>
      {!user && <><div><Label htmlFor="account-email">Your email</Label><Input id="account-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></div><div><Label htmlFor="account-password">Password</Label><Input id="account-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e=>setPassword(e.target.value)}/></div></>}
      <div><Label htmlFor="currency">Default currency</Label><Input id="currency" maxLength={3} pattern="[A-Z]{3}" value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())}/></div>
      <div><Label htmlFor="timezone">Timezone</Label><Input id="timezone" required value={timezone} onChange={e=>setTimezone(e.target.value)}/></div>
      <div className="md:col-span-2"><Label htmlFor="divisions">Operating divisions (comma separated)</Label><Input id="divisions" value={divisions} onChange={e=>setDivisions(e.target.value)}/></div>
      <Button disabled={busy} type="submit">{busy ? 'Creating…' : 'Create workspace'}</Button>
    </form></CardContent></Card>
  </div></main>;
}
