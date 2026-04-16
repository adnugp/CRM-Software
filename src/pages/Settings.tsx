import React, { useState, useEffect } from 'react';
import { User, Users, Bell, Shield, Palette, Info, Sun, Moon, Monitor, UserPlus, Trash2, Mail, Lock, AlertCircle, ExternalLink } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useData } from '@/contexts/DataContext';

// Helper Component for User Rows
const StaffRow: React.FC<{
    user: any;
    onRemove: () => void;
}> = ({ user, onRemove }) => (
    <TableRow className="hover:bg-muted/20 transition-colors">
        <TableCell className="font-medium">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {user.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground md:hidden">{user.email}</p>
                </div>
            </div>
        </TableCell>
        <TableCell>
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold ${user.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30' :
                    user.role === 'manager' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30' :
                        user.role === 'user' ? 'bg-green-100 text-green-700 dark:bg-green-900/30' :
                            'bg-amber-100 text-amber-700 dark:bg-amber-900/30'
                }`}>
                {user.role === 'admin' ? 'Admin' :
                    user.role === 'manager' ? 'Manager' :
                        user.role === 'user' ? 'Employee' :
                            'Client'}
            </span>
        </TableCell>
        <TableCell className="text-muted-foreground text-sm hidden md:table-cell">{user.email}</TableCell>
        <TableCell className="text-right">
            <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                    e.stopPropagation();
                    console.info(`[Settings] Row Click: Revoke Access for ${user.name} (ID: ${user.id})`);
                    onRemove();
                }}
            >
                <Trash2 className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Revoke Access</span>
                <span className="sm:hidden text-xs">Del</span>
            </Button>
        </TableCell>
    </TableRow>
);

// Settings Page Component
const Settings: React.FC = () => {
    const { user, allUsers, removeUser, updateProfile, updatePassword } = useAuth();
    const { employees, registrations, deleteEmployee, deleteRegistration } = useData();
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
        console.group(`Auth Action: Revoke Access`);
        console.info(`Target User: ${name} (${id})`);

        if (window.confirm(`Are you sure you want to remove ${name}? This will revoke their access immediately.`)) {
            try {
                const success = await removeUser(id);
                console.info(`Result: ${success ? 'Success' : 'Failed/Restricted'}`);

                if (success) {
                    toast({
                        title: "User Removed",
                        description: `${name} has been successfully removed from the system.`,
                    });
                } else {
                    toast({
                        title: "Action Restricted",
                        description: `Cannot remove ${name}. This account is protected or doesn't exist.`,
                        variant: "destructive"
                    });
                }
            } catch (err) {
                console.error(`Error during revoke:`, err);
                toast({
                    title: "System Error",
                    description: "An unexpected error occurred while revoking access.",
                    variant: "destructive"
                });
            }
        } else {
            console.info(`Action cancelled by user.`);
        }
        console.groupEnd();
    };

    const handleDeleteEmployeeRecord = async (id: string, name: string) => {
        console.group(`Data Action: Wipe Employee`);
        console.info(`Target Employee Record: ${name} (${id})`);

        if (window.confirm(`PERMANENT DELETION: Are you sure you want to delete ${name}'s data? This cannot be undone and is for resigned employees only.`)) {
            try {
                await deleteEmployee(id);
                console.info(`Employee record deleted from context and storage.`);
                toast({
                    title: "Employee Record Deleted",
                    description: "The resigned employee's data has been wiped.",
                    variant: "destructive"
                });
            } catch (err) {
                console.error(`Error wiping employee:`, err);
                toast({
                    title: "Error",
                    description: "Failed to wipe employee data.",
                    variant: "destructive"
                });
            }
        }
        console.groupEnd();
    };

    const handleDeleteClientRecord = async (id: string, name: string) => {
        console.group(`Data Action: Wipe Client`);
        console.info(`Target Client ID: ${id}`);

        if (window.confirm(`PERMANENT DELETION: Are you sure you want to delete the registration for ${name}? This will wipe all associated metadata.`)) {
            try {
                await deleteRegistration(id);
                console.info(`Client record deleted.`);
                toast({
                    title: "Client Record Deleted",
                    description: "The registration/project record has been wiped.",
                    variant: "destructive"
                });
            } catch (err) {
                console.error(`Error wiping client:`, err);
            }
        }
        console.groupEnd();
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

                        {/* Admin-only Panel */}
                        {isAdmin && (
                            <Card className="overflow-hidden border-2 border-primary/20 shadow-lg animate-slide-up">
                                <CardHeader className="bg-primary/5 border-b">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2 text-primary">
                                                <Shield className="h-5 w-5" />
                                                Administrative Controls
                                            </CardTitle>
                                            <CardDescription className="text-secondary font-medium">
                                                Manage system users, access roles, and platform portals.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <Tabs defaultValue="access" className="w-full">
                                        <div className="bg-muted/30 px-6 py-2 border-b">
                                            <TabsList className="bg-transparent gap-6">
                                                <TabsTrigger
                                                    value="access"
                                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-10 transition-all"
                                                >
                                                    Access Control
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="staff"
                                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-10 transition-all"
                                                >
                                                    Staff Offboarding
                                                </TabsTrigger>
                                                <TabsTrigger
                                                    value="clients"
                                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 h-10 transition-all"
                                                >
                                                    Client Offboarding
                                                </TabsTrigger>
                                            </TabsList>
                                        </div>

                                        <TabsContent value="access" className="p-6 space-y-10 m-0">
                                            {/* Specialized Registration Portals */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* Employee Registration */}
                                                <div className="group relative overflow-hidden flex flex-col items-center justify-between p-8 rounded-3xl bg-gradient-to-br from-blue-500/5 via-blue-500/10 to-transparent border border-blue-500/20 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500">
                                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                        <Users className="h-24 w-24 -mr-8 -mt-8" />
                                                    </div>
                                                    <div className="space-y-3 text-center mb-6 relative z-10">
                                                        <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                            <UserPlus className="h-8 w-8" />
                                                        </div>
                                                        <h3 className="text-xl font-black text-blue-700">Team Onboarding</h3>
                                                        <p className="text-xs font-medium text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                                                            Register new staff members, managers, and operational personnel.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        onClick={() => navigate('/registration/employee')}
                                                        className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 font-bold tracking-tight transition-all active:scale-95"
                                                    >
                                                        Register Employee
                                                        <ExternalLink className="ml-2 h-4 w-4" />
                                                    </Button>
                                                </div>

                                                {/* Client Registration */}
                                                <div className="group relative overflow-hidden flex flex-col items-center justify-between p-8 rounded-3xl bg-gradient-to-br from-primary/5 via-primary/10 to-transparent border border-primary/20 shadow-sm hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
                                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                        <Shield className="h-24 w-24 -mr-8 -mt-8" />
                                                    </div>
                                                    <div className="space-y-3 text-center mb-6 relative z-10">
                                                        <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                            <Shield className="h-8 w-8" />
                                                        </div>
                                                        <h3 className="text-xl font-black text-primary">Client Gateway</h3>
                                                        <p className="text-xs font-medium text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                                                            Create secure Entity IDs and access for Dubai Police, DEWA, and others.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        onClick={() => navigate('/registration/client')}
                                                        className="w-full h-11 gradient-primary text-white rounded-xl shadow-lg shadow-primary/30 font-bold tracking-tight transition-all active:scale-95"
                                                    >
                                                        Onboard Client
                                                        <ExternalLink className="ml-2 h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* Access Tables Split by System/Client */}
                                            <div className="space-y-12 pb-4">
                                                {/* Staff Table */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-lg font-bold flex items-center gap-2">
                                                            <Shield className="h-5 w-5 text-primary" />
                                                            System Access (Staff)
                                                        </h4>
                                                        <span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold uppercase">
                                                            {allUsers.filter(u => u.role !== 'client').length} Active Staff
                                                        </span>
                                                    </div>
                                                    <div className="border rounded-xl bg-card overflow-hidden">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted/50">
                                                                    <TableHead>System User</TableHead>
                                                                    <TableHead>Role</TableHead>
                                                                    <TableHead className="hidden md:table-cell">Login Email</TableHead>
                                                                    <TableHead className="text-right">Actions</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {allUsers.filter(u => u.role !== 'client').map((u) => (
                                                                    <StaffRow key={u.id} user={u} onRemove={() => handleRemoveUser(u.id, u.name)} />
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>

                                                {/* Client Table */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-lg font-bold flex items-center gap-2">
                                                            <Lock className="h-5 w-5 text-amber-500" />
                                                            External Access (Clients)
                                                        </h4>
                                                        <span className="text-xs bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full font-bold uppercase">
                                                            {allUsers.filter(u => u.role === 'client').length} Client Gateways
                                                        </span>
                                                    </div>
                                                    <div className="border rounded-xl bg-card overflow-hidden">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted/50">
                                                                    <TableHead>Client User</TableHead>
                                                                    <TableHead>Role</TableHead>
                                                                    <TableHead className="hidden md:table-cell">Login Email</TableHead>
                                                                    <TableHead className="text-right">Actions</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {allUsers.filter(u => u.role === 'client').length === 0 ? (
                                                                    <TableRow>
                                                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No external client accounts registered.</TableCell>
                                                                    </TableRow>
                                                                ) : (
                                                                    allUsers.filter(u => u.role === 'client').map((u) => (
                                                                        <StaffRow key={u.id} user={u} onRemove={() => handleRemoveUser(u.id, u.name)} />
                                                                    ))
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="staff" className="p-6 m-0">
                                            <div className="space-y-6">
                                                <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl">
                                                    <p className="text-sm font-semibold text-destructive flex items-center gap-2">
                                                        <AlertCircle className="h-4 w-4" />
                                                        Resigned Staff Data Management
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Use this section to permanently wipe employee records when they resign. This is separate from revoking their login access.
                                                    </p>
                                                </div>
                                                <div className="border rounded-xl overflow-hidden shadow-sm">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-muted/50">
                                                                <TableHead>Full Name</TableHead>
                                                                <TableHead>Position</TableHead>
                                                                <TableHead>Join Date</TableHead>
                                                                <TableHead className="text-right">Wipe Record</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {employees.length === 0 ? (
                                                                <TableRow><TableCell colSpan={4} className="text-center py-10">No employee records found.</TableCell></TableRow>
                                                            ) : (
                                                                employees.map((emp) => (
                                                                    <TableRow key={emp.id} className="hover:bg-muted/20">
                                                                        <TableCell className="font-bold">{emp.name}</TableCell>
                                                                        <TableCell className="text-sm">{emp.position}</TableCell>
                                                                        <TableCell className="text-xs text-muted-foreground">{emp.joinDate}</TableCell>
                                                                        <TableCell className="text-right">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="text-destructive hover:bg-destructive hover:text-white border-destructive/30"
                                                                                onClick={() => handleDeleteEmployeeRecord(emp.id, emp.name)}
                                                                            >
                                                                                <Trash2 className="h-4 w-4 md:mr-2" />
                                                                                <span className="hidden md:inline">Wipe Employee Data</span>
                                                                            </Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </TabsContent>

                                        <TabsContent value="clients" className="p-6 m-0">
                                            <div className="space-y-6">
                                                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                                                    <p className="text-sm font-semibold text-amber-600 flex items-center gap-2">
                                                        <AlertCircle className="h-4 w-4" />
                                                        Closed Client/Project Data Removal
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Permanently remove registration data or completed project records. Typically used when a client project cycle ends.
                                                    </p>
                                                </div>
                                                <div className="border rounded-xl overflow-hidden shadow-sm">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow className="bg-muted/50">
                                                                <TableHead>Entity Name</TableHead>
                                                                <TableHead>Company</TableHead>
                                                                <TableHead>Status</TableHead>
                                                                <TableHead className="text-right">Wipe Record</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {registrations.length === 0 ? (
                                                                <TableRow><TableCell colSpan={4} className="text-center py-10">No registration records found.</TableCell></TableRow>
                                                            ) : (
                                                                registrations.map((reg) => (
                                                                    <TableRow key={reg.id} className="hover:bg-muted/20">
                                                                        <TableCell className="font-bold">{reg.name}</TableCell>
                                                                        <TableCell className="text-sm">{reg.company}</TableCell>
                                                                        <TableCell>
                                                                            <span className="text-[10px] uppercase font-bold bg-muted px-2 py-0.5 rounded-full">{reg.status}</span>
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="text-destructive hover:bg-destructive hover:text-white border-destructive/30"
                                                                                onClick={() => handleDeleteClientRecord(reg.id, reg.name)}
                                                                            >
                                                                                <Trash2 className="h-4 w-4 md:mr-2" />
                                                                                <span className="hidden md:inline">Wipe Profile</span>
                                                                            </Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                        </TabsContent>
                                    </Tabs>
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
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-bold">
                                        <Palette className="h-4 w-4 text-primary" />
                                        App Theme
                                    </div>
                                    <Select value={theme} onValueChange={(value: any) => setTheme(value)}>
                                        <SelectTrigger className="w-[120px] h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="light">Light Mode</SelectItem>
                                            <SelectItem value="dark">Dark Mode</SelectItem>
                                            <SelectItem value="system">System</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-muted-foreground">Compact View</p>
                                    <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest"> </span>
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


