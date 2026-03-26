import React, { useState, useEffect } from 'react';
import { User, Bell, Shield, Palette, Info, Sun, Moon, Monitor, UserPlus, Trash2, Mail, Lock, AlertCircle } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import { useAuth } from '@/contexts/AuthContext';
import EmailAlertSettings from '@/components/notifications/EmailAlertSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { UserRole } from '@/types';

// Settings Page Component
const Settings: React.FC = () => {
    const { user, allUsers, addUser, removeUser } = useAuth();
    const { toast } = useToast();
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
        return (localStorage.getItem('crm-theme') as 'light' | 'dark' | 'system') || 'system';
    });

    // Add User Form State
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('user');
    const [isAddingUser, setIsAddingUser] = useState(false);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }
        localStorage.setItem('crm-theme', theme);
    }, [theme]);

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsAddingUser(true);
        try {
            const success = await addUser(newName, newEmail, newPassword, newRole);
            if (success) {
                toast({
                    title: "User Created",
                    description: `${newName} has been added as a ${newRole}.`,
                });
                setNewName('');
                setNewEmail('');
                setNewPassword('');
                setNewRole('user');
            } else {
                toast({
                    title: "Registration Failed",
                    description: "User with this email already exists.",
                    variant: "destructive"
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsAddingUser(false);
        }
    };

    const handleRemoveUser = async (id: string, name: string) => {
        if (confirm(`Are you sure you want to remove ${name}? This will revoke their access immediately.`)) {
            const success = await removeUser(id);
            if (success) {
                toast({
                    title: "User Removed",
                    description: `${name} has been successfully removed from the system.`,
                });
            }
        }
    };

    const isAdmin = user?.role === 'admin';

    return (
        <MainLayout>
            <div className="flex flex-col gap-6 animate-fade-in pb-10">
                <PageHeader
                    title="Settings"
                    description="Manage your account preferences and application settings."
                />

                <div className="grid gap-8 mt-4 grid-cols-1 xl:grid-cols-3">
                    {/* Main Settings Column */}
                    <div className="xl:col-span-2 space-y-8">
                        
                        {/* Admin-only User Management Portal */}
                        {isAdmin && (
                            <Card className="overflow-hidden border-2 border-primary/20 shadow-lg animate-slide-up">
                                <CardHeader className="bg-primary/5 border-b">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-primary">
                                                <UserPlus className="h-5 w-5" />
                                                User Management Portal
                                            </CardTitle>
                                            <CardDescription className="text-primary/70">
                                                Add, remove, and manage system access for your team and clients.
                                            </CardDescription>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            <Shield className="h-5 w-5 text-primary" />
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-8 space-y-10">
                                    {/* Add User Form Section */}
                                    <div className="space-y-6">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            Add New Access Portal
                                        </h3>
                                        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/30 p-6 rounded-xl border border-dashed border-primary/30">
                                            <div className="space-y-2">
                                                <Label htmlFor="new-name">Full Name</Label>
                                                <Input 
                                                    id="new-name" 
                                                    value={newName} 
                                                    onChange={e => setNewName(e.target.value)} 
                                                    placeholder="Employee or Client Name" 
                                                    required 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-email">Email Address</Label>
                                                <Input 
                                                    id="new-email" 
                                                    type="email" 
                                                    value={newEmail} 
                                                    onChange={e => setNewEmail(e.target.value)} 
                                                    placeholder="email@example.com" 
                                                    required 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-password">Initial Password</Label>
                                                <Input 
                                                    id="new-password" 
                                                    type="password" 
                                                    value={newPassword} 
                                                    onChange={e => setNewPassword(e.target.value)} 
                                                    placeholder="••••••••" 
                                                    required 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="new-role">Access Role</Label>
                                                <Select value={newRole} onValueChange={(v: UserRole) => setNewRole(v)}>
                                                    <SelectTrigger id="new-role">
                                                        <SelectValue placeholder="Select role" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="admin">Administrator</SelectItem>
                                                        <SelectItem value="user">Manager / Employee</SelectItem>
                                                        <SelectItem value="client">Client Portal</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="md:col-span-2 pt-2">
                                                <Button type="submit" className="w-full gradient-primary text-white" disabled={isAddingUser}>
                                                    {isAddingUser ? "Processing..." : "Create User Portal"}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>

                                    {/* User List Table Section */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold">User Directory & Active Portals</h3>
                                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                                                {allUsers.length} Active Users
                                            </p>
                                        </div>
                                        <div className="border rounded-xl bg-card overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead>User</TableHead>
                                                        <TableHead>Role</TableHead>
                                                        <TableHead>Email</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {allUsers.map((u) => (
                                                        <TableRow key={u.id} className="hover:bg-muted/20 transition-colors">
                                                            <TableCell className="font-medium">{u.name}</TableCell>
                                                            <TableCell>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                                                                    u.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 
                                                                    u.role === 'user' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 
                                                                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                                                                }`}>
                                                                    {u.role}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleRemoveUser(u.id, u.name)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    Deactivate
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                    {allUsers.length === 0 && (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                                                                No user-created accounts found.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Profile Section */}
                        <Card className="overflow-hidden border-2 transition-all hover:border-primary/20">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-primary" />
                                    Profile Information
                                </CardTitle>
                                <CardDescription>
                                    Your account details and personal appearance settings.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-border">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary text-3xl font-bold">
                                        {user?.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold">{user?.name}</h3>
                                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize mt-1">
                                            {user?.role} Role
                                        </div>
                                    </div>
                                    <Button variant="outline" className="sm:ml-auto">Change Avatar</Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label htmlFor="full-name">Full Name</Label>
                                        <Input id="full-name" defaultValue={user?.name || ''} placeholder="Your Name" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email-display">Email Address</Label>
                                        <Input id="email-display" defaultValue={user?.email || ''} disabled className="bg-muted" />
                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Info className="h-3 w-3" />
                                            Email changes require administrative approval.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4">
                                    <Button className="gradient-primary text-white">Update Profile</Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Notifications Section */}
                        <Card className="overflow-hidden border-2 transition-all hover:border-primary/20">
                            <CardHeader className="bg-muted/30">
                                <CardTitle className="flex items-center gap-2">
                                    <Bell className="h-5 w-5 text-primary" />
                                    Notification Preferences
                                </CardTitle>
                                <CardDescription>
                                    Control how and when you receive alerts from the system.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-6">
                                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border">
                                    <div className="space-y-1">
                                        <p className="font-semibold text-base flex items-center gap-2">
                                            Email Alerts System
                                        </p>
                                        <p className="text-sm text-muted-foreground pr-4">
                                            Stay updated on overdue payments, tender deadlines, and registration expiries.
                                        </p>
                                    </div>
                                    <EmailAlertSettings />
                                </div>

                                <Separator />

                                <div className="space-y-4 pt-2">
                                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">In-App Notifications</h4>
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">System Announcements</Label>
                                            <p className="text-sm text-muted-foreground">Receive updates about new features and maintenance.</p>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-primary">Configure</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column: Security & Appearance */}
                    <div className="space-y-6">
                        {/* Appearance Section */}
                        <Card className="overflow-hidden border-2 transition-all hover:border-primary/20">
                            <CardHeader className="bg-muted/30 pb-4">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Palette className="h-5 w-5 text-primary" />
                                    Theme & Appearance
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-3">
                                    <p className="text-sm font-medium">Application Theme</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <Button 
                                            variant={theme === 'light' ? 'default' : 'outline'} 
                                            size="sm" 
                                            className="gap-2"
                                            onClick={() => setTheme('light')}
                                        >
                                            <Sun className="h-4 w-4" />
                                            Light
                                        </Button>
                                        <Button 
                                            variant={theme === 'dark' ? 'default' : 'outline'} 
                                            size="sm" 
                                            className="gap-2"
                                            onClick={() => setTheme('dark')}
                                        >
                                            <Moon className="h-4 w-4" />
                                            Dark
                                        </Button>
                                        <Button 
                                            variant={theme === 'system' ? 'default' : 'outline'} 
                                            size="sm" 
                                            className="gap-2"
                                            onClick={() => setTheme('system')}
                                        >
                                            <Monitor className="h-4 w-4" />
                                            Auto
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <p className="text-sm font-medium">Compact Mode</p>
                                    <Button variant="ghost" size="sm" className="text-foreground/40" disabled>Soon</Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Security Section */}
                        <Card className="overflow-hidden border-2 transition-all hover:border-primary/20">
                            <CardHeader className="bg-muted/30 pb-4">
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Shield className="h-5 w-5 text-primary" />
                                    Security & Access
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 space-y-4">
                                <div className="space-y-4">
                                    <Alert variant="default" className="bg-primary/5 border-primary/20">
                                        <Info className="h-4 w-4" />
                                        <AlertTitle className="text-xs uppercase font-bold text-primary">Security Tip</AlertTitle>
                                        <AlertDescription className="text-xs">
                                            Enable Two-Factor Authentication for enhanced security.
                                        </AlertDescription>
                                    </Alert>
                                    
                                    <Button variant="outline" className="w-full justify-start text-sm">
                                        Change Password
                                    </Button>
                                    <Button variant="outline" className="w-full justify-start text-sm">
                                        Manage Active Sessions
                                    </Button>
                                </div>
                                
                                <Separator className="my-6" />
                                
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold text-destructive uppercase">Danger Zone</h4>
                                    <Button variant="ghost" className="w-full justify-start text-destructive hover:bg-destructive/10 text-sm">
                                        Request Account Deletion
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default Settings;


