import React, { useState, useMemo } from "react";
import {
  Bell,
  X,
  CreditCard,
  FileCheck,
  FileText,
  FolderKanban,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useData } from "@/contexts/DataContext";
import { cn } from "@/lib/utils";

type NotificationType = "overdue" | "expiring" | "deadline" | "billing";

interface Notification {
  id: string;
  type: NotificationType;
  category: "payment" | "registration" | "tender" | "project" | "subscription";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  urgency: "high" | "medium" | "low";
}

const NotificationCenter: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const { projects, tenders, payments, subscriptions, registrations } = useData();

  const notifications = useMemo(() => {
    const notifs: Notification[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getDaysDifference = (dateStr: string) => {
      const targetDate = new Date(dateStr);
      targetDate.setHours(0, 0, 0, 0);
      return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    // --- Payments ---
    payments.forEach(payment => {
      const id = `payment-${payment.id}`;
      if (dismissedIds.has(id)) return;

      const daysDiff = getDaysDifference(payment.dueDate);

      if (payment.status === "overdue" || daysDiff < 0) {
        notifs.push({
          id,
          type: "overdue",
          category: "payment",
          title: "Overdue Payment",
          message: `${payment.description} - $${payment.amount.toLocaleString()} is overdue`,
          timestamp: new Date(payment.dueDate),
          read: false,
          urgency: "high",
        });
      } else if (daysDiff <= 7 && payment.status === "pending") {
        notifs.push({
          id,
          type: "deadline",
          category: "payment",
          title: "Payment Due Soon",
          message: `${payment.description} - $${payment.amount.toLocaleString()} due in ${daysDiff} day${daysDiff !== 1 ? "s" : ""}`,
          timestamp: new Date(payment.dueDate),
          read: false,
          urgency: daysDiff <= 3 ? "high" : "medium",
        });
      }
    });

    // --- Subscriptions ---
    subscriptions.forEach(subscription => {
      const id = `subscription-${subscription.id}`;
      if (dismissedIds.has(id)) return;
      if (!subscription.nextBillingDate) return;

      const daysDiff = getDaysDifference(subscription.nextBillingDate);

      if (daysDiff >= 0 && daysDiff <= 7) {
        notifs.push({
          id,
          type: "billing",
          category: "subscription",
          title: "Upcoming Billing",
          message: `${subscription.name} - $${subscription.amount.toLocaleString()} billing in ${daysDiff} day${daysDiff !== 1 ? "s" : ""}`,
          timestamp: new Date(subscription.nextBillingDate),
          read: false,
          urgency: daysDiff <= 3 ? "medium" : "low",
        });
      }
    });

    // --- Registrations ---
    registrations.forEach(registration => {
      const id = `registration-${registration.id}`;
      if (dismissedIds.has(id)) return;

      const daysDiff = getDaysDifference(registration.expiryDate);

      if (registration.status === "expired" || daysDiff < 0) {
        notifs.push({
          id,
          type: "expiring",
          category: "registration",
          title: "Expired Registration",
          message: `${registration.name} has expired`,
          timestamp: new Date(registration.expiryDate),
          read: false,
          urgency: "high",
        });
      } else if (daysDiff <= 30) {
        notifs.push({
          id,
          type: "expiring",
          category: "registration",
          title: "Registration Expiring",
          message: `${registration.name} expires in ${daysDiff} day${daysDiff !== 1 ? "s" : ""}`,
          timestamp: new Date(registration.expiryDate),
          read: false,
          urgency: daysDiff <= 7 ? "high" : daysDiff <= 14 ? "medium" : "low",
        });
      }
    });

    // --- Tenders ---
    tenders.forEach(tender => {
      const id = `tender-${tender.id}`;
      if (dismissedIds.has(id)) return;

      const daysDiff = getDaysDifference(tender.deadline);

      if (tender.status === "open") {
        if (daysDiff < 0) {
          notifs.push({
            id,
            type: "overdue",
            category: "tender",
            title: "Tender Deadline Passed",
            message: `${tender.name} deadline has passed`,
            timestamp: new Date(tender.deadline),
            read: false,
            urgency: "high",
          });
        } else if (daysDiff <= 14) {
          notifs.push({
            id,
            type: "deadline",
            category: "tender",
            title: "Tender Deadline Approaching",
            message: `${tender.name} due in ${daysDiff} day${daysDiff !== 1 ? "s" : ""}`,
            timestamp: new Date(tender.deadline),
            read: false,
            urgency: daysDiff <= 3 ? "high" : daysDiff <= 7 ? "medium" : "low",
          });
        }
      }
    });

    // --- Projects ---
    projects.forEach(project => {
      const id = `project-${project.id}`;
      if (dismissedIds.has(id)) return;

      const daysDiff = getDaysDifference(project.deadline);

      if (["in-progress", "pending"].includes(project.status)) {
        if (daysDiff < 0) {
          notifs.push({
            id,
            type: "overdue",
            category: "project",
            title: "Project Overdue",
            message: `${project.name} deadline has passed`,
            timestamp: new Date(project.deadline),
            read: false,
            urgency: "high",
          });
        } else if (daysDiff <= 14) {
          notifs.push({
            id,
            type: "deadline",
            category: "project",
            title: "Project Deadline Approaching",
            message: `${project.name} due in ${daysDiff} day${daysDiff !== 1 ? "s" : ""}`,
            timestamp: new Date(project.deadline),
            read: false,
            urgency: daysDiff <= 3 ? "high" : daysDiff <= 7 ? "medium" : "low",
          });
        }
      }
    });

    // --- Sort by urgency first, then timestamp ---
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    return notifs.sort((a, b) => {
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return a.timestamp.getTime() - b.timestamp.getTime();
    });
  }, [dismissedIds, payments, subscriptions, tenders, projects, registrations]);

  const dismissNotification = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const dismissAll = () => {
    setDismissedIds(new Set(notifications.map(n => n.id)));
  };

  const getIcon = (category: Notification["category"]) => {
    switch (category) {
      case "payment":
        return CreditCard;
      case "registration":
        return FileCheck;
      case "tender":
        return FileText;
      case "project":
        return FolderKanban;
      case "subscription":
        return Calendar;
      default:
        return Bell;
    }
  };

  const getIconColors = (urgency: Notification["urgency"]) => {
    switch (urgency) {
      case "high":
        return { bg: "bg-destructive/10", text: "text-destructive" };
      case "medium":
        return { bg: "bg-warning/10", text: "text-warning" };
      case "low":
        return { bg: "bg-primary/10", text: "text-primary" };
      default:
        return { bg: "bg-muted", text: "text-muted-foreground" };
    }
  };

  const highUrgencyCount = notifications.filter(n => n.urgency === "high").length;

  // --- Dynamic height calculation ---
  const itemHeight = 80; // each notification approx height (adjust if needed)
  const maxVisibleItems = 2.75;
  const visibleCount = Math.min(notifications.length, maxVisibleItems);
  const panelHeight = visibleCount * itemHeight;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <Badge
              className={cn(
                "absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs",
                highUrgencyCount > 0
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-warning text-warning-foreground"
              )}
            >
              {notifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="font-semibold text-foreground">Notifications</h3>
            {highUrgencyCount > 0 && (
              <p className="text-xs text-destructive">
                {highUrgencyCount} urgent item{highUrgencyCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {notifications.length > 0 && (
            <Button variant="ghost" size="sm" onClick={dismissAll}>
              Clear all
            </Button>
          )}
        </div>

        {notifications.length > 0 && (
          <ScrollArea
            className="w-full"
            style={{
              height: panelHeight,
              maxHeight: maxVisibleItems * itemHeight,
            }}
          >
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {notifications.map(notification => {
                  const Icon = getIcon(notification.category);
                  const colors = getIconColors(notification.urgency);

                  return (
                    <motion.div
                      key={notification.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div
                        className={cn(
                          "p-4 hover:bg-muted/50 transition-colors",
                          notification.urgency === "high" && "bg-destructive/5"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
                              colors.bg
                            )}
                          >
                            <Icon className={cn("h-4 w-4", colors.text)} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{notification.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1 capitalize">
                              {notification.category}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => dismissNotification(notification.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;