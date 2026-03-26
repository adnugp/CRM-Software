import React, { useState, useEffect } from 'react';
import { User, Bell, Shield, Palette, Info, Sun, Moon, Monitor, UserPlus, Trash2, Mail, Lock, AlertCircle, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Settings Page Component
const Settings: React.FC = () => {
    const { user, allUsers, removeUser, updateProfile, updatePassword } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
        return (localStorage.getItem('crm-theme') as 'light' | 'dark' | 'system') || 'system';
    });

    // Profile & Password States
    const [profileName, setProfileName] = useState(user?.name || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    useEffect(() => {
        if (user) setProfileName(user.name);
    }, [user]);

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

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingProfile(true);
        const success = await updateProfile(profileName, user?.email || '');
        if (success) {
            toast({
                title: "Profile Updated",
                description: "Your changes have been saved successfully.",
            });
        }
        setIsUpdatingProfile(false);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmNewPassword) {
            toast({
                title: "Error",
                description: "New passwords do not match.",
                variant: "destructive"
            });
            return;
        }
        setIsChangingPassword(true);
        const success = await updatePassword(currentPassword, newPassword);
        if (success) {
            toast({
                title: "Password Changed",
                description: "Your security credentials have been updated.",
            });
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
        } else {
            toast({
                title: "Change Failed",
                description: "Current password was incorrect.",
                variant: "destructive"
            });
        }
        setIsChangingPassword(false);
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
                        
                        {/* Admin-only User Management Portal Summary */}
                        {isAdmin && (
                            <Card className="overflow-hidden border-2 border-primary/20 shadow-lg animate-slide-up">
                                <CardHeader className="bg-primary/5 border-b">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-primary">
                                                <Shield className="h-5 w-5" />
                                                Administrative Controls
                                            </CardTitle>
                                            <CardDescription className="text-primary/70">
                                                Manage system users, access roles, and platform portals.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-8 space-y-10">
                                    {/* Link to Registration Portal */}
                                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
                                        <div className="space-y-2 text-center md:text-left">
                                          <h3 className="text-xl font-bold text-primary flex items-center justify-center md:justify-start gap-2">
                                            <UserPlus className="h-6 w-6" />
                                            Registration Portal
                                          </h3>
                                          <p className="text-sm text-muted-foreground max-w-md">
                                            Access the dedicated portal to onboard new employees, managers, or create restricted client access gateways.
                                          </p>
                                        </div>
                                        <Button 
                                          onClick={() => navigate('/register')} 
                                          className="w-full md:w-auto px-8 h-12 gradient-primary text-white shadow-lg hover:shadow-xl transition-all"
                                        >
                                          Open Portal
                                          <ExternalLink className="ml-2 h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* User List Table Section */}
                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold">User Directory & Active Portals</h3>
                                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                                                {allUsers.length} Active Accounts
                                            </p>
                                        </div>
                                        <div className="border rounded-xl bg-card overflow-hidden">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="bg-muted/50">
                                                        <TableHead>User</TableHead>
                                                        <TableHead>Role</TableHead>
                                                        <TableHead className="hidden md:table-cell">Email</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {allUsers.map((u) => (
                                                        <TableRow key={u.id} className="hover:bg-muted/20 transition-colors">
                                                            <TableCell className="font-medium">
                                                              <div>
                                                                <p>{u.name}</p>
                                                                <p className="text-[10px] text-muted-foreground md:hidden">{u.email}</p>
                                                              </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${
                                                                    u.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' : 
                                                                    u.role === 'user' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' : 
                                                                    'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                                                                }`}>
                                                                    {u.role === 'admin' ? 'Admin' : u.role === 'user' ? 'Manager' : 'Client'}
                                                                </span>
                                                            </TableCell>
                                                            <TableCell className="text-muted-foreground text-sm hidden md:table-cell">{u.email}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    className="text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleRemoveUser(u.id, u.name)}
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                                    <span className="hidden sm:inline">Delete User</span>
                                                                    <span className="sm:hidden text-xs">Del</span>
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
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
                                        {profileName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold">{profileName}</h3>
                                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                                        <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize mt-1">
                                            {user?.role} Role
                                        </div>
                                    </div>
                                    <Button variant="outline" className="sm:ml-auto">Change Avatar</Button>
                                </div>

                                <form onSubmit={handleUpdateProfile} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="full-name">Full Name</Label>
                                            <Input 
                                                id="full-name" 
                                                value={profileName} 
                                                onChange={e => setProfileName(e.target.value)} 
                                                placeholder="Your Name" 
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="email-display">Email Address</Label>
                                            <Input id="email-display" defaultValue={user?.email || ''} disabled className="bg-muted cursor-not-allowed" />
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Info className="h-3 w-3" />
                                                Email changes require administrative approval.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end pt-4">
                                        <Button type="submit" className="gradient-primary text-white" disabled={isUpdatingProfile}>
                                            {isUpdatingProfile ? 'Saving...' : 'Update Profile'}
                                        </Button>
                                    </div>
                                </form>
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
                                    
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" className="w-full justify-start text-sm gap-2">
                                                <Lock className="h-4 w-4" />
                                                Change Security Password
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <form onSubmit={handleChangePassword}>
                                                <DialogHeader>
                                                    <DialogTitle>Update Password</DialogTitle>
                                                    <DialogDescription>
                                                        Ensure your account is protected with a strong, unique password.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div className="grid gap-4 py-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="current">Current Password</Label>
                                                        <Input 
                                                            id="current" 
                                                            type="password" 
                                                            value={currentPassword} 
                                                            onChange={e => setCurrentPassword(e.target.value)}
                                                            required 
                                                        />
                                                    </div>
                                                    <Separator className="my-2" />
                                                    <div className="space-y-2">
                                                        <Label htmlFor="new">New Password</Label>
                                                        <Input 
                                                            id="new" 
                                                            type="password" 
                                                            value={newPassword} 
                                                            onChange={e => setNewPassword(e.target.value)}
                                                            required 
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor="confirm">Confirm New Password</Label>
                                                        <Input 
                                                            id="confirm" 
                                                            type="password" 
                                                            value={confirmNewPassword} 
                                                            onChange={e => setConfirmNewPassword(e.target.value)}
                                                            required 
                                                        />
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button type="submit" className="gradient-primary text-white w-full" disabled={isChangingPassword}>
                                                        {isChangingPassword ? "Updating..." : "Update Security Credentials"}
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </DialogContent>
                                    </Dialog>

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


