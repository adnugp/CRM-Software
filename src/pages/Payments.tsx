import React, { useState } from 'react';
import { CreditCard, Calendar, Building, DollarSign, RefreshCw, AlertCircle, CheckCircle, Plus, Pencil, XCircle, BadgeCheck } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import PaymentConfirmDialog from '@/components/ui/PaymentConfirmDialog';
import PaymentForm from '@/components/forms/PaymentForm';
import SubscriptionForm from '@/components/forms/SubscriptionForm';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Payment, Subscription } from '@/types';
import { toast } from '@/hooks/use-toast';

const CURRENCY = 'AED';
const VAT_RATE = 0.05;

const formatCurrency = (amount: number) => {
  return `${CURRENCY} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const Plans: Record<string, { label: string; color: string }> = {
  basic: { label: 'Basic', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  pro: { label: 'Pro', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  enterprise: { label: 'Enterprise', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

const getPlanBadge = (subscription: Subscription) => {
  const key = subscription.name?.toLowerCase().includes('enterprise') ? 'enterprise'
    : subscription.name?.toLowerCase().includes('pro') ? 'pro'
    : 'basic';
  const plan = Plans[key] || Plans.basic;
  return (
    <Badge className={`${plan.color} border-none font-semibold`}>
      <BadgeCheck className="h-3 w-3 mr-1" />
      {plan.label}
    </Badge>
  );
};

const Payments: React.FC = () => {
  const {
    payments,
    subscriptions,
    addPayment,
    updatePayment,
    addSubscription,
    updateSubscription,
    loading
  } = useData();
  const { user } = useAuth();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [subscriptionFormOpen, setSubscriptionFormOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  const [cancelSubDialogOpen, setCancelSubDialogOpen] = useState(false);
  const [subToCancel, setSubToCancel] = useState<Subscription | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isEmployee = user?.role === 'user';
  const canEdit = isAdmin || isManager || isEmployee;
  const canView = true;

  if (loading.payments || loading.subscriptions) {
    return (
      <MainLayout>
        <PageHeader title="Payments & Subscriptions" description="Loading..." />
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  const totalPending = payments
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalVAT = totalPending * VAT_RATE;

  const totalSubscriptions = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.billingCycle === 'monthly' ? s.amount : s.amount / 12), 0);

  const handleMarkPaid = (payment: Payment) => {
    setSelectedPayment(payment);
    setConfirmDialogOpen(true);
  };

  const confirmMarkPaid = async () => {
    if (selectedPayment) {
      setIsProcessing(true);
      setOperationError(null);
      try {
        await updatePayment(selectedPayment.id, { ...selectedPayment, status: 'paid' as const });
        toast({
          title: 'Payment marked as paid',
          description: `"${selectedPayment.description}" has been marked as paid.`,
        });
        setSelectedPayment(null);
      } catch (error) {
        const msg = 'Failed to mark payment as paid. Please try again.';
        setOperationError(msg);
        toast({ title: 'Error', description: msg, variant: 'destructive' });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleAddPayment = () => {
    setEditingPayment(null);
    setPaymentFormOpen(true);
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    setPaymentFormOpen(true);
  };

  const handlePaymentSubmit = async (paymentData: Omit<Payment, 'id'> & { id?: string }) => {
    setIsProcessing(true);
    setOperationError(null);
    try {
      if (paymentData.id) {
        await updatePayment(paymentData.id, paymentData);
        toast({
          title: 'Payment updated',
          description: `"${paymentData.description}" has been updated.`,
        });
      } else {
        const { id, ...paymentWithoutId } = paymentData;
        await addPayment(paymentWithoutId);
        toast({
          title: 'Payment added',
          description: `"${paymentData.description}" has been added.`,
        });
      }
    } catch (error) {
      const msg = 'Failed to save payment. Please try again.';
      setOperationError(msg);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddSubscription = () => {
    setEditingSubscription(null);
    setSubscriptionFormOpen(true);
  };

  const handleEditSubscription = (subscription: Subscription) => {
    setEditingSubscription(subscription);
    setSubscriptionFormOpen(true);
  };

  const handleSubscriptionSubmit = async (subscriptionData: Omit<Subscription, 'id'> & { id?: string }) => {
    setIsProcessing(true);
    setOperationError(null);
    try {
      if (subscriptionData.id) {
        await updateSubscription(subscriptionData.id, subscriptionData);
        toast({
          title: 'Subscription updated',
          description: `"${subscriptionData.name}" has been updated.`,
        });
      } else {
        const { id, ...subscriptionWithoutId } = subscriptionData;
        await addSubscription(subscriptionWithoutId);
        toast({
          title: 'Subscription added',
          description: `"${subscriptionData.name}" has been added.`,
        });
      }
    } catch (error) {
      const msg = 'Failed to save subscription. Please try again.';
      setOperationError(msg);
      toast({
        title: 'Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <MainLayout>
      <PageHeader
        title="Payments & Subscriptions"
        description="Manage pending payments and active subscriptions"
      />

      {operationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{operationError}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertCircle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(totalPending)}
              </p>
              <p className="text-sm text-muted-foreground">Pending Payments</p>
              <p className="text-xs text-muted-foreground mt-1">
                +{formatCurrency(totalVAT)} VAT (5%)
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <RefreshCw className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(totalSubscriptions)}/mo
              </p>
              <p className="text-sm text-muted-foreground">Monthly Subscriptions</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {subscriptions.filter(s => s.status === 'active').length}
              </p>
              <p className="text-sm text-muted-foreground">Active Subscriptions</p>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="payments" className="animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="payments" className="data-[state=active]:bg-card">
              <CreditCard className="h-4 w-4 mr-2" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="data-[state=active]:bg-card">
              <RefreshCw className="h-4 w-4 mr-2" />
              Subscriptions
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="payments">
          <div className="flex justify-end mb-4">
            {canEdit && (
              <Button onClick={handleAddPayment} className="bg-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            )}
          </div>
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Description</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      {payment.description}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        {payment.company}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 font-semibold">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        {formatCurrency(payment.amount)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(payment.dueDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={payment.status} variant="payment" />
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditPayment(payment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {payment.status !== 'paid' && (
                            <Button
                              size="sm"
                              className="bg-primary text-primary-foreground"
                              onClick={() => handleMarkPaid(payment)}
                            >
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions">
          <div className="flex justify-end mb-4">
            {canEdit && (
              <Button onClick={handleAddSubscription} className="bg-primary text-primary-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Add Subscription
              </Button>
            )}
          </div>
          <div className="rounded-xl border bg-card shadow-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Service Name</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>VAT (5%)</TableHead>
                  <TableHead>Billing Cycle</TableHead>
                  <TableHead>Next Billing</TableHead>
                  <TableHead>Status</TableHead>
                  {canEdit && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((subscription) => (
                  <TableRow key={subscription.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      {subscription.name}
                    </TableCell>
                    <TableCell>
                      {getPlanBadge(subscription)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {subscription.provider}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 font-semibold">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        {formatCurrency(subscription.amount)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatCurrency(subscription.amount * VAT_RATE)}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {subscription.billingCycle}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {new Date(subscription.nextBillingDate).toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={subscription.status} variant="subscription" />
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditSubscription(subscription)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {subscription.status === 'active' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSubToCancel(subscription);
                                setCancelSubDialogOpen(true);
                              }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <PaymentConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        paymentDescription={selectedPayment?.description || ''}
        paymentAmount={selectedPayment?.amount || 0}
        currency={CURRENCY}
        onConfirm={confirmMarkPaid}
      />

      <AlertDialog open={cancelSubDialogOpen} onOpenChange={setCancelSubDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left">
              Are you sure you want to cancel this subscription? This action cannot be undone.
              <div className="mt-3 p-3 rounded-lg bg-muted">
                <p className="font-medium text-foreground">{subToCancel?.name}</p>
                <p className="text-lg font-bold text-destructive">
                  {formatCurrency(subToCancel?.amount || 0)}/{subToCancel?.billingCycle}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (subToCancel) {
                  setIsProcessing(true);
                  setOperationError(null);
                  try {
                    await updateSubscription(subToCancel.id, { ...subToCancel, status: 'cancelled' });
                    toast({
                      title: 'Subscription Cancelled',
                      description: `"${subToCancel.name}" has been cancelled.`,
                    });
                    setSubToCancel(null);
                  } catch (error) {
                    const msg = 'Failed to cancel subscription. Please try again.';
                    setOperationError(msg);
                    toast({ title: 'Error', description: msg, variant: 'destructive' });
                  } finally {
                    setIsProcessing(false);
                  }
                }
              }}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              disabled={isProcessing}
            >
              {isProcessing ? 'Cancelling...' : 'Confirm Cancellation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaymentForm
        open={paymentFormOpen}
        onOpenChange={setPaymentFormOpen}
        onSubmit={handlePaymentSubmit}
        payment={editingPayment}
      />

      <SubscriptionForm
        open={subscriptionFormOpen}
        onOpenChange={setSubscriptionFormOpen}
        onSubmit={handleSubscriptionSubmit}
        subscription={editingSubscription}
      />
    </MainLayout>
  );
};

export default Payments;
