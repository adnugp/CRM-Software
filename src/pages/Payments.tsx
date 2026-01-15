import React, { useState } from 'react';
import {  CreditCard, Calendar, Building, DollarSign, RefreshCw, AlertCircle, CheckCircle, Plus, Pencil } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import PaymentConfirmDialog from '@/components/ui/PaymentConfirmDialog';
import PaymentForm from '@/components/forms/PaymentForm';
import SubscriptionForm from '@/components/forms/SubscriptionForm';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Payment, Subscription } from '@/types';
import { toast } from '@/hooks/use-toast';

const Payments: React.FC = () => {
  const {
    payments,
    subscriptions,
    addPayment,
    updatePayment,
    addSubscription,
    updateSubscription
  } = useData();
  const { user } = useAuth();
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [subscriptionFormOpen, setSubscriptionFormOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
  
  const isClient = user?.role === 'client';
  const canEdit = user?.role === 'admin' || user?.role === 'user';
  const totalPending = payments
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalSubscriptions = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + (s.billingCycle === 'monthly' ? s.amount : s.amount / 12), 0);

  const handleMarkPaid = (payment: Payment) => {
    setSelectedPayment(payment);
    setConfirmDialogOpen(true);
  };

  const confirmMarkPaid = async () => {
    if (selectedPayment) {
      try {
        await updatePayment(selectedPayment.id, { ...selectedPayment, status: 'paid' as const });
        toast({
          title: 'Payment marked as paid',
          description: `"${selectedPayment.description}" has been marked as paid.`,
        });
        setSelectedPayment(null);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to mark payment as paid. Please try again.',
          variant: 'destructive',
        });
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
      toast({
        title: 'Error',
        description: 'Failed to save payment. Please try again.',
        variant: 'destructive',
      });
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
      toast({
        title: 'Error',
        description: 'Failed to save subscription. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout>
      <PageHeader 
        title="Payments & Subscriptions"
        description="Manage pending payments and active subscriptions"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border bg-card p-5 shadow-card animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <AlertCircle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                ${totalPending.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Pending Payments</p>
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
                ${totalSubscriptions.toLocaleString()}/mo
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
                  <TableHead>Actions</TableHead>
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
                        {payment.amount.toLocaleString()}
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {canEdit && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditPayment(payment)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {payment.status !== 'paid' && canEdit && (
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
                  <TableHead>Provider</TableHead>
                  <TableHead>Amount</TableHead>
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
                    <TableCell className="text-muted-foreground">
                      {subscription.provider}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 font-semibold">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        {subscription.amount.toLocaleString()}
                      </div>
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
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleEditSubscription(subscription)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
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
        onConfirm={confirmMarkPaid}
      />

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
