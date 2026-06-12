import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, AlertCircle, LogIn, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/services/auth';
import gpLogo from '@/assets/gp-logo.png';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [failedAttempts, setFailedAttempts] = useState(() => {
    const stored = localStorage.getItem('loginFailedAttempts');
    return stored ? parseInt(stored, 10) : 0;
  });
  const [lockoutUntil, setLockoutUntil] = useState(() => {
    const stored = localStorage.getItem('loginLockoutUntil');
    return stored ? parseInt(stored, 10) : 0;
  });

  useEffect(() => {
    if (lockoutUntil > Date.now()) {
      const timer = setTimeout(() => {
        setLockoutUntil(0);
        localStorage.removeItem('loginLockoutUntil');
      }, lockoutUntil - Date.now());
      return () => clearTimeout(timer);
    }
  }, [lockoutUntil]);

  const isLockedOut = lockoutUntil > Date.now();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const validateEmail = (value: string): boolean => EMAIL_REGEX.test(value);

  const getFirebaseErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address. Please check or register.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect password. Please try again.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/too-many-requests':
        return 'Too many login attempts. Account temporarily locked. Please try again later.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact your administrator.';
      default:
        return 'Invalid email or password. Please try again.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address (e.g., user@domain.com).');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      setFailedAttempts(0);
      localStorage.removeItem('loginFailedAttempts');
      localStorage.removeItem('loginLockoutUntil');
      navigate('/');
    } else {
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      localStorage.setItem('loginFailedAttempts', newAttempts.toString());

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockoutTime = Date.now() + LOCKOUT_DURATION_MS;
        setLockoutUntil(lockoutTime);
        localStorage.setItem('loginLockoutUntil', lockoutTime.toString());
        setError(`Too many failed attempts. Login locked for 15 minutes.`);
      } else {
        setError(getFirebaseErrorMessage(result.errorCode || 'auth/unknown'));
      }
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
    } catch (err: any) {
      const code = err.code || '';
      if (code === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
    }
    setIsLoading(false);
  };

  const resetForgotPassword = () => {
    setShowForgotPassword(false);
    setResetEmailSent(false);
    setError('');
  };

  const getLockoutRemaining = () => {
    if (!isLockedOut) return '';
    const remaining = Math.ceil((lockoutUntil - Date.now()) / 60000);
    return `${remaining} minute${remaining !== 1 ? 's' : ''} remaining`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8 animate-fade-in">
          <img src={gpLogo} alt="SadeemGPT Logo" className="h-24 mx-auto mb-4" />
          <h1 className="text-4xl font-bold text-foreground tracking-tight">
            SadeemGPT
          </h1>
        </div>

        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 animate-slide-up">
          {!showForgotPassword ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <LogIn className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold text-foreground">
                  Welcome back
                </h2>
              </div>
              <p className="text-muted-foreground mb-6">
                Sign in to your account to continue
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm animate-shake">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    {error}
                    {isLockedOut && (
                      <span className="font-semibold ml-1">{getLockoutRemaining()}</span>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError('');
                      }}
                      placeholder="Enter your email"
                      className={`pl-10 h-12 border-2 focus:border-primary transition-colors ${email && !validateEmail(email) ? 'border-destructive' : ''}`}
                      required
                    />
                  </div>
                  {email && !validateEmail(email) && (
                    <p className="text-xs text-destructive mt-1">Please enter a valid email (e.g., user@domain.com)</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Password</label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-10 pr-10 h-12 border-2 focus:border-primary transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl text-lg font-semibold"
                  disabled={isLoading || isLockedOut}
                >
                  {isLoading ? 'Signing in...' : isLockedOut ? `Locked (${getLockoutRemaining()})` : 'Sign in'}
                </Button>
              </form>
            </>
          ) : (
            <>
              {!resetEmailSent ? (
                <>
                  <button
                    onClick={resetForgotPassword}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to login
                  </button>
                  
                  <div className="flex items-center gap-3 mb-2">
                    <Mail className="h-6 w-6 text-primary" />
                    <h2 className="text-2xl font-bold text-foreground">
                      Reset Password
                    </h2>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    Enter your email and we'll send you a reset link
                  </p>

                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm animate-shake">
                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Email</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          className={`pl-10 h-12 border-2 focus:border-primary transition-colors ${email && !validateEmail(email) ? 'border-destructive' : ''}`}
                          required
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl text-lg font-semibold"
                      disabled={isLoading}
                    >
                      {isLoading ? 'Sending...' : 'Send Reset Link'}
                    </Button>
                  </form>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <CheckCircle className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-foreground mb-2">
                    Check your email
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    We've sent a password reset link to<br />
                    <span className="font-medium text-foreground">{email}</span>
                  </p>
                  <Button
                    onClick={resetForgotPassword}
                    variant="outline"
                    className="w-full h-12"
                  >
                    Back to login
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
