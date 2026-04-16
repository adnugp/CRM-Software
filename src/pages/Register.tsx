import React, { useState } from 'react';
import { Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, UserPlus, Info, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';
import gpLogo from '@/assets/gp-logo.png';
import { useToast } from '@/hooks/use-toast';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const Register: React.FC = () => {
  const location = useLocation();
  const isClientRegistration = location.pathname.includes('client');
  const isEmployeeRegistration = location.pathname.includes('employee');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>(isClientRegistration ? 'client' : 'user');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [clientCompany, setClientCompany] = useState('');
  const [parentCompany, setParentCompany] = useState<'Sadeem' | 'Grow Plus'>('Sadeem');
  const [entityId, setEntityId] = useState('');
  const { addUser, allUsers } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (role === 'client' && !clientCompany) {
        setError('Please enter the Client Entity name');
        return;
    }

    setIsLoading(true);

    // Generate accurate organizationId for clients
    let finalOrgId = undefined;
    if (role === 'client') {
        const parentPrefix = parentCompany === 'Sadeem' ? 'SAD' : 'GP';
        const clientPrefix = clientCompany.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 3);
        
        // Count existing for this combo
        const existingCount = allUsers.filter(u => 
            u.organizationId?.startsWith(`${parentPrefix}-${clientPrefix}`)
        ).length;
        
        finalOrgId = `${parentPrefix}-${clientPrefix}-${(existingCount + 1).toString().padStart(3, '0')}`;
    }

    const success = await addUser(name, email, password, role, role === 'client' ? clientCompany : undefined, finalOrgId);
    
    if (success) {
      toast({
        title: "User Created",
        description: `Successfully created ${role} account for ${name}.`,
      });
      navigate('/');
    } else {
      setError('Email already registered');
    }
    setIsLoading(false);
  };

  return (
    <MainLayout>
      <div className="animate-fade-in space-y-6">
        <PageHeader 
          title="User Registration" 
          description="Create and manage administrative, manager, or client accounts for the CRM system."
        />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Main Form Area */}
          <div className="xl:col-span-2">
            <div className="bg-card border border-border rounded-xl shadow-card p-6 md:p-8 animate-slide-up">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <UserPlus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Account Details</h2>
                  <p className="text-sm text-muted-foreground">Enter the information for the new user account below.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm animate-shake border border-destructive/20">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Identity & Role */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-name"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="John Doe"
                          className="pl-10 h-11"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="john@example.com"
                          className="pl-10 h-11"
                          required
                        />
                      </div>
                    </div>

                    <div className={`space-y-2 pt-2 ${isClientRegistration ? 'hidden' : ''}`}>
                        <Label htmlFor="reg-role">Access Role</Label>
                        <Select value={role} onValueChange={(value: UserRole) => setRole(value)}>
                            <SelectTrigger id="reg-role" className="h-11">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">Administrator (Full Access, No Finance)</SelectItem>
                                <SelectItem value="manager">Manager (Full Access & Financial Audit)</SelectItem>
                                <SelectItem value="user">Employee (Standard Access, Restricted Finance)</SelectItem>
                                {!isEmployeeRegistration && <SelectItem value="client">Client (Restricted Access, No Settings)</SelectItem>}
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground italic px-1">
                            Roles define what data and actions the user can access.
                        </p>
                    </div>

                    {role === 'client' && (
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-4 animate-in fade-in slide-in-from-top-2">
                           <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Client Entity Binding
                           </h3>
                           
                           <div className="space-y-2">
                                <Label htmlFor="parent-company">Parent Organization</Label>
                                <Select value={parentCompany} onValueChange={(v: any) => setParentCompany(v)}>
                                    <SelectTrigger id="parent-company">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Sadeem">Sadeem Energy (SAD)</SelectItem>
                                        <SelectItem value="Grow Plus">Grow Plus Technology (GP)</SelectItem>
                                    </SelectContent>
                                </Select>
                           </div>

                           <div className="space-y-2">
                                <Label htmlFor="client-entity">Client Entity Name (e.g. Dubai Police)</Label>
                                <Input 
                                    id="client-entity"
                                    value={clientCompany}
                                    onChange={(e) => setClientCompany(e.target.value)}
                                    placeholder="Dubai Police / DEWA"
                                    required
                                />
                           </div>

                           <div className="pt-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Preview Entity ID</p>
                                <p className="text-lg font-mono font-bold text-primary">
                                    {parentCompany === 'Sadeem' ? 'SAD' : 'GP'}-
                                    {clientCompany ? clientCompany.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 3) : '???'}-001
                                </p>
                           </div>
                        </div>
                    )}
                  </div>

                  {/* Right Column: Security */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pl-10 h-11"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-confirm">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-confirm"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="pl-10 h-11"
                          required
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <div className="p-4 rounded-lg bg-muted/30 border border-dashed border-border space-y-2">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
                          <Info className="h-3 w-3" />
                          Password Policy
                        </h4>
                        <ul className="text-[10px] text-muted-foreground space-y-1 list-disc pl-4">
                          <li>Minimum 6 characters required</li>
                          <li>Avoid using common dictionary words</li>
                          <li>Passwords are encrypted before storage</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t">
                  <Link to="/" className="text-sm text-muted-foreground hover:text-primary transition-colors order-2 sm:order-1">
                    Cancel and return to dashboard
                  </Link>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto px-8 h-12 gradient-primary text-white shadow-lg hover:shadow-xl transition-all order-1 sm:order-2"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating User...' : 'Add User Account'}
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* Side Info Panel */}
          <div className="space-y-6">
            <Card className="border-2 border-primary/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Registration Guide</CardTitle>
                <CardDescription>Understanding user roles and permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isClientRegistration && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-primary">Administrator</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Full system access including employees and settings. Prohibited from viewing financial data.
                    </p>
                  </div>
                )}
                {!isClientRegistration && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-sm font-bold text-blue-600">Manager</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Full access to the system, including comprehensive financial data, audit records, and confidential project details.
                    </p>
                  </div>
                )}
                {!isClientRegistration && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-sm font-bold text-green-600">Employee</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Standard business operations and project management. Can enter project budgets but is restricted from viewing or entering profits, costs, and financial leakages.
                    </p>
                  </div>
                )}
                {!isEmployeeRegistration && (
                  <div className="space-y-2 pt-2">
                    <h4 className="text-sm font-bold text-slate-600">Client</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      View-only access restricted to their own projects, tenders and payments. Cannot see system settings.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-800 dark:text-amber-400">Important</AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-500 text-xs">
                New users will be able to log in immediately after you create their account. Use a secure temp password and advise them to change it on first login.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Register;