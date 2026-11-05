import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Loader2 } from 'lucide-react';
import PublicShell from '@/components/brand/PublicShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { PLANS, SALES_EMAIL, TRIAL_DAYS, formatPrice, type PlanId } from '@/config/plans';
import { cn } from '@/lib/utils';

const schema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company name').max(100, 'Keep it under 100 characters'),
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Use at least 6 characters'),
  confirm: z.string(),
}).refine(v => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

type Values = z.infer<typeof schema>;

const Signup: React.FC = () => {
  const { isAuthenticated, signUpCompany } = useAuth();
  const [plan, setPlan] = useState<PlanId>('team');
  const [error, setError] = useState('');
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { companyName: '', name: '', email: '', password: '', confirm: '' },
  });

  // Also where a successful sign-up lands: the new session opens the app.
  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (values: Values) => {
    setError('');
    const result = await signUpCompany({
      plan, companyName: values.companyName, name: values.name, email: values.email, password: values.password,
    });
    if (result !== true) setError(result);
  };

  const field = (name: keyof Values, label: string, type = 'text', autoComplete?: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field: input }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} autoComplete={autoComplete} {...input} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <PublicShell wide>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">Start your free trial</h1>
        <p className="mt-2 text-muted-foreground">
          {TRIAL_DAYS} days free, no card needed. Pick a plan by team size; clients are always free.
        </p>
      </div>

      <div role="radiogroup" aria-label="Plan" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map(p => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={plan === p.id}
            onClick={() => setPlan(p.id)}
            className={cn(
              'rounded-xl border bg-card p-5 text-left transition hover:border-primary',
              plan === p.id && 'border-primary ring-2 ring-primary/30'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{p.name}</span>
              {plan === p.id && <Check className="h-4 w-4 text-primary" />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Up to {p.staffLimit} staff</p>
            <p className="mt-3 text-lg font-bold text-foreground">{formatPrice(p, 'monthly')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{p.blurb}</p>
          </button>
        ))}
        <a
          href={`mailto:${SALES_EMAIL}?subject=Enterprise%20plan`}
          className="rounded-xl border border-dashed bg-card p-5 text-left transition hover:border-primary"
        >
          <span className="font-semibold text-foreground">Enterprise</span>
          <p className="mt-1 text-sm text-muted-foreground">More than 50 staff</p>
          <p className="mt-3 text-lg font-bold text-foreground">Contact us</p>
        </a>
      </div>

      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader>
          <CardTitle>Create your company</CardTitle>
          <CardDescription>You'll be its admin and can invite your team next.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {field('companyName', 'Company name', 'text', 'organization')}
              {field('name', 'Your name', 'text', 'name')}
              {field('email', 'Work email', 'email', 'email')}
              {field('password', 'Password', 'password', 'new-password')}
              {field('confirm', 'Confirm password', 'password', 'new-password')}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start free trial
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </PublicShell>
  );
};

export default Signup;
