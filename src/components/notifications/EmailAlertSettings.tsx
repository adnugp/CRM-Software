import React, { useState, useEffect } from "react";
import { Mail, Settings, BellRing, Save, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const EmailAlertSettings: React.FC = () => {
    const [enabled, setEnabled] = useState(false);
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        // Load settings from localStorage (mocking sync with backend)
        const saved = localStorage.getItem("crm_email_alert_settings");
        if (saved) {
            const data = JSON.parse(saved);
            setEnabled(data.enabled);
            setEmail(data.email);
        }
    }, []);

    const handleSave = () => {
        setLoading(true);
        // In a real app, this would send an API request to the backend
        setTimeout(() => {
            localStorage.setItem("crm_email_alert_settings", JSON.stringify({ enabled, email }));
            setLoading(false);
            toast({
                title: "Settings Saved",
                description: "Your email alert preferences have been updated.",
            });
        }, 800);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="h-4 w-4" />
                    Alert Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-primary" />
                        Email Alert Settings
                    </DialogTitle>
                    <DialogDescription>
                        Configure how you receive critical notifications via email when you're away from the dashboard.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="flex items-center justify-between space-x-2 border-b pb-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="email-alerts" className="text-base">
                                Enable Email Alerts
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Receive daily summaries of overdue payments and expiring items.
                            </p>
                        </div>
                        <Switch
                            id="email-alerts"
                            checked={enabled}
                            onCheckedChange={setEnabled}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="alert-email">Recipient Email Address</Label>
                        <Input
                            id="alert-email"
                            type="email"
                            placeholder="admin@gptechnologies.ae"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={!enabled}
                        />
                        <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                            <Info className="h-3 w-3 mt-0.5" />
                            Multiple emails can be separated by commas in the backend configuration.
                        </p>
                    </div>

                    <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                            <BellRing className="h-4 w-4 text-warning" />
                            Included Alerts
                        </h4>
                        <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                            <li>Overdue payments and pending bills</li>
                            <li>Registrations expiring within 30 days</li>
                            <li>Project deadlines approaching in 14 days</li>
                            <li>Tender deadlines passing or approaching</li>
                        </ul>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={handleSave} disabled={loading} className="w-full sm:w-auto">
                        <Save className="h-4 w-4 mr-2" />
                        {loading ? "Saving..." : "Save Preferences"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EmailAlertSettings;
