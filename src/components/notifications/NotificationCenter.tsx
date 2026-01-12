import React, { useState, useMemo } from 'react';
import { Bell, X, AlertTriangle, CreditCard, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { payments, registrations } from '@/data/mockData';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: 'overdue' | 'expiring';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

const NotificationCenter: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const notifications = useMemo(() => {
    const notifs: Notification[] = [];

    // Check for overdue payments
    payments
      .filter(p => p.status === 'overdue')
      .forEach(payment => {
        const id = `payment-${payment.id}`;
        if (!dismissedIds.has(id)) {
          notifs.push({
            id,
            type: 'overdue',
            title: 'Overdue Payment',
            message: `${payment.description} - $${payment.amount.toLocaleString()} is overdue`,
            timestamp: new Date(payment.dueDate),
            read: false,
          });
        }
      });

    // Check for expiring registrations (within 30 days or expired)
    const today = new Date();
    registrations
      .filter(r => {
        const expiryDate = new Date(r.expiryDate);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return r.status === 'expired' || (daysUntilExpiry <= 30 && daysUntilExpiry > 0);
      })
      .forEach(registration => {
        const id = `registration-${registration.id}`;
        if (!dismissedIds.has(id)) {
          const expiryDate = new Date(registration.expiryDate);
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const isExpired = registration.status === 'expired';
          
          notifs.push({
            id,
            type: 'expiring',
            title: isExpired ? 'Expired Registration' : 'Expiring Soon',
            message: isExpired 
              ? `${registration.name} has expired`
              : `${registration.name} expires in ${daysUntilExpiry} days`,
            timestamp: expiryDate,
            read: false,
          });
        }
      });

    return notifs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [dismissedIds]);

  const dismissNotification = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const dismissAll = () => {
    setDismissedIds(new Set(notifications.map(n => n.id)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs"
            >
              {notifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-foreground">Notifications</h3>
          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={dismissAll}>
              Clear all
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 hover:bg-muted/50 transition-colors',
                    !notification.read && 'bg-muted/30'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                      notification.type === 'overdue' ? 'bg-destructive/10' : 'bg-warning/10'
                    )}>
                      {notification.type === 'overdue' ? (
                        <CreditCard className="h-4 w-4 text-destructive" />
                      ) : (
                        <FileCheck className="h-4 w-4 text-warning" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-foreground">{notification.title}</p>
                        <AlertTriangle className={cn(
                          'h-3 w-3',
                          notification.type === 'overdue' ? 'text-destructive' : 'text-warning'
                        )} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {notification.message}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => dismissNotification(notification.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
