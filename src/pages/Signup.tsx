import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, CreditCard, Loader2, Lock } from 'lucide-react';
import PublicShell from '@/components/brand/PublicShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { savePaymentMethod, PaymentError } from '@/services/billing';
import {
  PLANS, SALES_EMAIL, TRIAL_DAYS, YEARLY_MONTHS_CHARGED, formatPrice, planById,
  type BillingCycle, type PlanId,
} from '@/config/plans';
import { addDays } from '@/lib/subscription';
import { formatCardNumber, formatExpiry, validateCard } from '@/lib/payment';
import { cn } from '@/lib/utils';

const schema = z.object({
  companyName: z.string().trim().min(2, 'Enter your company name').max(100, 'Keep it under 100 characters'),
  name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Use at least 6 characters'),
  confirm: z.string(),
  cardName: z.string(),
  cardNumber: z.string(),
  cardExpiry: z.string(),
  cardCvc: z.string(),
}).superRefine((v, ctx) => {
  if (v.password !== v.confirm) ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'Passwords do not match' });
  const problems = validateCard({ name: v.cardName, number: v.cardNumber, expiry: v.cardExpiry, cvc: v.cardCvc }, new Date());
  const paths = { name: 'cardName', number: 'cardNumber', expiry: 'cardExpiry', cvc: 'cardCvc' } as const;
  for (const [field, message] of Object.entries(problems)) {
    ctx.addIssue({ code: 'custom', path: [paths[field as keyof typeof paths]], message });
  }
});

type Values = z.infer<typeof schema>;

const CYCLES: { id: BillingCycle; label: string }[] = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: `Yearly · ${12 - YEARLY_MONTHS_CHARGED} months free` },
];

const Signup: React.FC = () => {
  const { isAuthenticated, signUpCompany } = useAuth();
  const [plan, setPlan] = useState<PlanId>('team');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [error, setError] = useState('');
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      companyName: '', name: '', email: '', password: '', confirm: '',
      cardName: '', cardNumber: '', cardExpiry: '', cardCvc: '',
    },
  });

  // Also where a successful sign-up lands: the new session opens the app.
  if (isAuthenticated) return <Navigate to="/" replace />;

  const chosen = planById(plan) ?? PLANS[0];
  const firstCharge = addDays(new Date(), TRIAL_DAYS).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const onSubmit = async (values: Values) => {
    setError('');
    // The card goes on file first, so a declined card never creates a login.
    let paymentMethod;
    try {
      paymentMethod = await savePaymentMethod({
        name: values.cardName, number: values.cardNumber, expiry: values.cardExpiry, cvc: values.cardCvc,
      });
    } catch (err) {
      setError(err instanceof PaymentError ? err.message : 'We could not check your card. Please try again.');
      return;
    }
    const result = await signUpCompany({
      plan, billingCycle: cycle, paymentMethod,
      companyName: values.companyName, name: values.name, email: values.email, password: values.password,
    });
    if (result !== true) setError(result);
  };

  const field = (
    name: keyof Values,
    label: string,
    options: { type?: string; autoComplete?: string; inputMode?: 'numeric'; placeholder?: string; format?: (v: string) => string } = {},
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field: input }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={options.type ?? 'text'}
              autoComplete={options.autoComplete}
              inputMode={options.inputMode}
              placeholder={options.placeholder}
              {...input}
              onChange={e => input.onChange(options.format ? options.format(e.target.value) : e.target.value)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <PublicShell wide>
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-foreground">Start your free trial</h1>
        <p className="mt-2 text-muted-foreground">
          {TRIAL_DAYS} days free, cancel anytime. Pick a plan by team size; clients are always free.
        </p>
      </div>

      <div role="radiogroup" aria-label="Billing period" className="mx-auto mb-6 flex w-fit rounded-lg border bg-card p-1">
        {CYCLES.map(c => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={cycle === c.id}
            onClick={() => setCycle(c.id)}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition',
              cycle === c.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {c.label}
          </button>
        ))}
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
            <p className="mt-3 text-lg font-bold text-foreground">{formatPrice(p, cycle)}</p>
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

      <Card className="mx-auto mt-8 max-w-lg">
        <CardHeader>
          <CardTitle>Create your company</CardTitle>
          <CardDescription>You'll be its admin and can invite your team next.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {field('companyName', 'Company name', { autoComplete: 'organization' })}
              {field('name', 'Your name', { autoComplete: 'name' })}
              {field('email', 'Work email', { type: 'email', autoComplete: 'email' })}
              <div className="grid gap-4 sm:grid-cols-2">
                {field('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
                {field('confirm', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
              </div>

              <Separator className="my-2" />
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CreditCard className="h-4 w-4" /> Payment details
              </div>
              {field('cardName', 'Name on card', { autoComplete: 'cc-name' })}
              {field('cardNumber', 'Card number', {
                autoComplete: 'cc-number', inputMode: 'numeric', placeholder: '1234 1234 1234 1234', format: formatCardNumber,
              })}
              <div className="grid grid-cols-2 gap-4">
                {field('cardExpiry', 'Expiry', { autoComplete: 'cc-exp', inputMode: 'numeric', placeholder: 'MM/YY', format: formatExpiry })}
                {field('cardCvc', 'CVC', {
                  autoComplete: 'cc-csc', inputMode: 'numeric', placeholder: '123', format: v => v.replace(/\D/g, '').slice(0, 4),
                })}
              </div>
              <p className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Test mode: no real charge, and card details are not stored (only the card type and last 4 digits).
              </p>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start {TRIAL_DAYS}-day free trial
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                You won't be charged until {firstCharge}, then {formatPrice(chosen, cycle)} for the {chosen.name} plan.
              </p>
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
