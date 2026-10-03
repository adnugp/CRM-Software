import {Link} from 'react-router-dom';
import {useAuth} from '@/contexts/AuthContext';
import {Button} from '@/components/ui/button';
export default function EmailAlertSettings(){const {user}=useAuth();return user?.role==='admin'?<Button variant="outline" asChild><Link to="/workspace">Manage email reminders</Link></Button>:<p className="text-sm text-muted-foreground">Your workspace administrator manages email reminders.</p>;}
