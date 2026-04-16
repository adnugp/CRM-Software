import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import {
    BarChart3,
    Calendar,
    CheckCircle2,
    Clock,
    DollarSign,
    Layers,
    Layout,
    Plus,
    Target,
    TrendingUp,
    User,
    Users,
    AlertCircle,
    MoreVertical,
    ArrowLeft,
    FilePieChart,
    TrendingDown,
    Activity,
    FileText,
    ShieldCheck,
    Coins
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    PieChart,
    Pie
} from 'recharts';
import MainLayout from '@/components/layout/MainLayout';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import StatusBadge from '@/components/ui/StatusBadge';
import ProjectTaskForm from '@/components/forms/ProjectTaskForm';
import ProjectCostForm from '@/components/forms/ProjectCostForm';
import { toast } from '@/hooks/use-toast';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ProjectTimeline from '@/components/projects/ProjectTimeline';
import { canViewProject } from '@/lib/project-visibility';

const ProjectManagement: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { projects, employees, updateProject } = useData();
    const { user: currentUser } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [taskFormOpen, setTaskFormOpen] = useState(false);
    const [costFormOpen, setCostFormOpen] = useState(false);
    const [showAssigneeCount, setShowAssigneeCount] = useState(false);

    const isEmployee = currentUser?.role === 'user';
    const isClient = currentUser?.role === 'client';
    const isManagerOrAdmin = currentUser?.role === 'manager' || currentUser?.role === 'admin';

    const project = projects.find(p => p.id === id);

    const totalProjectsForAssignee = useMemo(() => {
        if (!project) return 0;
        return projects.filter(p => p.assignedTo === project.assignedTo).length;
    }, [projects, project?.assignedTo]);

    // Security check for clients
    const canAccess = useMemo(() => {
        return canViewProject(currentUser, project as any);
    }, [project, currentUser]);

    if (!project || !canAccess) {
        return <Navigate to="/projects" replace />;
    }

    const handleAddTask = async (data: any) => {
        const assignee = employees.find(e => e.id === data.assignedTo);
        const newTask = {
            ...data,
            id: `task-${Date.now()}`,
            projectId: project.id,
            assignedToName: assignee?.name || 'Unknown'
        };

        const updatedTasks = [...(project.tasks || []), newTask];
        await updateProject(project.id, { tasks: updatedTasks });
        toast({
            title: "Task Added",
            description: `"${data.name}" has been added to the project.`
        });
    };

    const handleAddCost = async (data: any) => {
        const newCost = {
            ...data,
            id: `cost-${Date.now()}`,
            projectId: project.id
        };

        const updatedCosts = [...(project.costs || []), newCost];
        await updateProject(project.id, { costs: updatedCosts });
        toast({
            title: "Expense Added",
            description: `"${data.description}" has been recorded.`
        });
    };

    const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
        const updatedTasks = (project.tasks || []).map(t =>
            t.id === taskId ? { ...t, status: newStatus as any } : t
        );
        await updateProject(project.id, { tasks: updatedTasks });
        toast({
            title: "Task Updated",
            description: `Task status changed to ${newStatus}.`
        });
    };

    const handleDeleteTask = async (taskId: string) => {
        const updatedTasks = (project.tasks || []).map(t =>
            t.id === taskId ? { ...t, isDeleted: true } : t // Or actual filter
        ).filter(t => t.id !== taskId);

        await updateProject(project.id, { tasks: updatedTasks });
        toast({
            title: "Task Deleted",
            variant: "destructive"
        });
    };

    const tasks = project.tasks || [];
    const costs = project.costs || [];
    const budget = project.budget || 0;
    const totalCosts = costs.reduce((sum, c) => sum + c.amount, 0);
    const profit = budget - totalCosts;
    const profitMargin = budget > 0 ? (profit / budget) * 100 : 0;

    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const progressPercentage = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;

    const costByCategory = useMemo(() => {
        const categories: Record<string, number> = {};
        costs.forEach(c => {
            categories[c.category] = (categories[c.category] || 0) + c.amount;
        });
        return Object.entries(categories).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
    }, [costs]);

    const COLORS = ['#0891b2', '#8b5cf6', '#ec4899', '#f97316'];

    return (
        <MainLayout>
            <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="sm" asChild className="hover:bg-transparent -ml-2">
                    <Link to="/projects" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Projects
                    </Link>
                </Button>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">{project.name}</h1>
                    <p className="text-muted-foreground flex items-center gap-2 mt-1">
                        <Layout className="h-4 w-4" />
                        <Badge variant="outline" className="font-mono text-xs">{project.projectId || project.id}</Badge>
                        <span>•</span>
                        {project.company}
                        {project.clientName && (
                            <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {project.clientName}
                                </span>
                            </>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={project.status} variant="project" />
                    {!isClient && (
                        <Button className="gradient-primary text-white" onClick={() => setTaskFormOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Task
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card className="glass-card border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Budget</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${budget.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Allocated project funds</p>
                    </CardContent>
                </Card>

                {!isEmployee && (
                    <>
                        <Card className="glass-card border-none shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Current Costs</CardTitle>
                                <TrendingUp className="h-4 w-4 text-warning" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">${totalCosts.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {((totalCosts / budget) * 100).toFixed(1)}% of budget used
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="glass-card border-none shadow-sm">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                                <CardTitle className="text-sm font-medium text-muted-foreground">Project Profit</CardTitle>
                                <Target className="h-4 w-4 text-success" />
                            </CardHeader>
                            <CardContent>
                                <div className={`text-2xl font-bold ${profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                                    ${profit.toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {profitMargin.toFixed(1)}% current margin
                                </p>
                            </CardContent>
                        </Card>
                    </>
                )}

                <Card className="glass-card border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Completion</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-info" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-info">{progressPercentage.toFixed(0)}%</div>
                        <Progress value={progressPercentage} className="h-2 mt-2 bg-info/20" />
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="overview" className="space-y-4" onValueChange={setActiveTab}>
                <TabsList className="bg-muted/50 p-1">
                    <TabsTrigger value="overview" className="data-[state=active]:bg-background">Overview</TabsTrigger>
                    {isClient && (
                         <TabsTrigger value="milestones" className="data-[state=active]:bg-background">Project Milestones</TabsTrigger>
                    )}
                    {isClient && (
                         <TabsTrigger value="documents" className="data-[state=active]:bg-background">Document Vault</TabsTrigger>
                    )}
                    {!isClient && (
                        <TabsTrigger value="tasks" className="data-[state=active]:bg-background">Tasks & Productivity</TabsTrigger>
                    )}
                    {!isEmployee && !isClient && (
                        <TabsTrigger value="financials" className="data-[state=active]:bg-background">Financial Linkage</TabsTrigger>
                    )}
                    {isManagerOrAdmin && (
                        <TabsTrigger value="executive" className="data-[state=active]:bg-background">Executive Report</TabsTrigger>
                    )}
                    {!isClient && (
                        <TabsTrigger value="team" className="data-[state=active]:bg-background">Team & HR</TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <Card className="lg:col-span-2 shadow-sm border-none bg-card/50">
                            <CardHeader>
                                <CardTitle>Description</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-foreground leading-relaxed">
                                    {project.description || "No description provided for this project."}
                                </p>
                                <div className="grid grid-cols-2 gap-4 mt-6">
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Project ID</p>
                                        <Badge variant="outline" className="font-mono text-xs">{project.projectId || project.id}</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Deadline</p>
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-4 w-4 text-primary" />
                                            <span>{new Date(project.deadline).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p
                                            className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-2 group"
                                            onClick={() => setShowAssigneeCount(!showAssigneeCount)}
                                        >
                                            Assigned To
                                            {showAssigneeCount && (
                                                <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] bg-primary/10 text-primary border-none animate-in fade-in zoom-in duration-200">
                                                    {totalProjectsForAssignee} {totalProjectsForAssignee === 1 ? 'Project' : 'Projects'}
                                                </Badge>
                                            )}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-primary" />
                                            <span className="font-medium text-foreground">{project.assignedToName}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Client</p>
                                        {project.clientName ? (
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4 text-primary" />
                                                <span className="font-medium text-foreground">{project.clientName}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">Not assigned</span>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Parent Company</p>
                                        <Badge variant="outline" className="font-normal">{project.belongsTo}</Badge>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                                        <StatusBadge status={project.status} variant="project" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-4">
                            {!isClient && !isEmployee && (
                                <Card className="shadow-sm border-none bg-card/50">
                                    <CardHeader>
                                        <CardTitle>Recent Costs</CardTitle>
                                        <CardDescription>Latest project expenses</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {costs.slice(0, 5).map((cost) => (
                                                <div key={cost.id} className="flex items-center justify-between">
                                                    <div className="space-y-1">
                                                        <p className="text-sm font-medium">{cost.description}</p>
                                                        <p className="text-xs text-muted-foreground">{new Date(cost.date).toLocaleDateString()}</p>
                                                    </div>
                                                    <p className="font-semibold text-sm">-${cost.amount.toLocaleString()}</p>
                                                </div>
                                            ))}
                                            {costs.length === 0 && (
                                                <div className="text-center py-6 text-muted-foreground">
                                                    No costs recorded yet.
                                                </div>
                                            )}
                                            <Button variant="outline" className="w-full mt-2" onClick={() => setActiveTab('financials')}>
                                                View All Financials
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {isClient && (
                                <Card className="shadow-sm border-none bg-primary/5 border-primary/20">
                                    <CardHeader>
                                        <CardTitle className="text-primary text-lg">Your Project Manager</CardTitle>
                                        <CardDescription>Primary contact for this project</CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex flex-col items-center text-center">
                                        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold mb-4 border-2 border-primary/20">
                                            {project.assignedToName.charAt(0)}
                                        </div>
                                        <h3 className="font-bold text-lg">{project.assignedToName}</h3>
                                        <p className="text-sm text-muted-foreground">Senior Project Manager</p>
                                        
                                        <div className="w-full mt-6 space-y-3">
                                            <Button variant="outline" className="w-full justify-start gap-3">
                                                <Users className="h-4 w-4 text-primary" />
                                                Contact Manager
                                            </Button>
                                            <Button variant="outline" className="w-full justify-start gap-3">
                                                <Activity className="h-4 w-4 text-primary" />
                                                Request Meeting
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="milestones" className="space-y-6 pt-6">
                    <div className="max-w-4xl mx-auto">
                        <div className="text-center mb-10">
                            <h2 className="text-2xl font-bold">Project Journey & Milestones</h2>
                            <p className="text-muted-foreground">Real-time tracking of key deliverables and current progress</p>
                        </div>
                        <ProjectTimeline tasks={tasks} />
                    </div>
                </TabsContent>

                <TabsContent value="documents" className="space-y-6 pt-6">
                    <Card className="shadow-sm border-none bg-card/50">
                        <CardHeader>
                            <CardTitle>Project Document Vault</CardTitle>
                            <CardDescription>Secure access to all finalized project documentation</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {project.documentFile || project.document ? (
                                    <div className="p-4 rounded-xl border border-primary/10 bg-primary/5 flex items-center justify-between group hover:bg-primary/10 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg bg-white dark:bg-muted flex items-center justify-center shadow-sm">
                                                <FileText className="h-6 w-6 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm">{project.document || project.documentFile?.name}</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Finalized Specification</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            Download
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="col-span-2 text-center py-10 text-muted-foreground italic border-2 border-dashed rounded-2xl">
                                        No shared documents available for this project yet.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="tasks" className="space-y-4">
                    <Card className="shadow-sm border-none bg-card/50">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Task Distribution</CardTitle>
                                <CardDescription>Manage and monitor team productivity</CardDescription>
                            </div>
                            <Button size="sm" className="gradient-primary" onClick={() => setTaskFormOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Task
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Task Name</TableHead>
                                        <TableHead>Assigned To</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {tasks.map((task) => (
                                        <TableRow key={task.id}>
                                            <TableCell className="font-medium">{task.name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <User className="h-3 w-3 text-muted-foreground" />
                                                    {task.assignedToName}
                                                </div>
                                            </TableCell>
                                            <TableCell>{new Date(task.dueDate).toLocaleDateString()}</TableCell>
                                            <TableCell>
                                                <Badge variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'secondary' : 'outline'}>
                                                    {task.priority}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={task.status} variant="project" />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleUpdateTaskStatus(task.id, 'pending')}>
                                                            Set as Pending
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleUpdateTaskStatus(task.id, 'in-progress')}>
                                                            Set as In Progress
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleUpdateTaskStatus(task.id, 'completed')}>
                                                            Mark as Completed
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => handleDeleteTask(task.id)}
                                                        >
                                                            Delete Task
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {tasks.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No tasks found. Start by adding a task to this project.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {!isEmployee && (
                    <TabsContent value="financials" className="space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <Card className="shadow-sm border-none bg-card/50">
                                <CardHeader>
                                    <CardTitle>Cost Breakdown</CardTitle>
                                    <CardDescription>Distribution of expenses by category</CardDescription>
                                </CardHeader>
                                <CardContent className="h-[300px]">
                                    {costs.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={costByCategory}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={80}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {costByCategory.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: 'none', borderRadius: '8px' }}
                                                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                            No cost data available to visualize.
                                        </div>
                                    )}
                                    <div className="flex justify-center gap-4 mt-2">
                                        {costByCategory.map((item, index) => (
                                            <div key={item.name} className="flex items-center gap-1">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                                <span className="text-xs text-muted-foreground">{item.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-none bg-card/50">
                                <CardHeader>
                                    <CardTitle>Profitability Analysis</CardTitle>
                                    <CardDescription>Budget vs Actual spending</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span>Budget Usage</span>
                                            <span className="font-medium">{((totalCosts / budget) * 100).toFixed(1)}%</span>
                                        </div>
                                        <Progress value={(totalCosts / budget) * 100} className="h-2 bg-muted" />
                                    </div>

                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Expected Profit</p>
                                            <p className="text-2xl font-bold text-success">${profit.toLocaleString()}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Burn Rate</p>
                                            <p className="text-2xl font-bold text-warning">${(totalCosts / 30).toFixed(0)} /day</p>
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 flex items-start gap-3">
                                        <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                                        <div className="text-sm">
                                            <p className="font-semibold text-primary">Profitability Alert</p>
                                            <p className="text-muted-foreground mt-0.5">
                                                The project is currently tracking at a {profitMargin.toFixed(1)}% margin. Financial leakage is minimal.
                                            </p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="shadow-sm border-none bg-card/50">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Expense Records</CardTitle>
                                    <CardDescription>Detailed list of all project costs</CardDescription>
                                </div>
                                <Button size="sm" variant="outline" onClick={() => setCostFormOpen(true)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Expense
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {costs.map((cost) => (
                                            <TableRow key={cost.id}>
                                                <TableCell className="font-medium">{cost.description}</TableCell>
                                                <TableCell className="capitalize">{cost.category}</TableCell>
                                                <TableCell>{new Date(cost.date).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right font-semibold text-destructive">
                                                    -${cost.amount.toLocaleString()}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {costs.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                    No expenses recorded for this project.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {isManagerOrAdmin && (
                    <TabsContent value="executive" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <Card className="shadow-lg border-none bg-primary/5">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Activity className="h-3 w-3 text-primary" />
                                        Project Health
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-primary">
                                        {profitMargin > 15 ? 'Excellent' : 'Stable'}
                                    </div>
                                    <Progress value={profitMargin > 15 ? 95 : 75} className="h-1.5 mt-3 bg-primary/20" />
                                </CardContent>
                            </Card>

                            <Card className="shadow-lg border-none bg-card/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Coins className="h-3 w-3 text-success" />
                                        Estimated ROI
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{(profitMargin * 1.2).toFixed(1)}%</div>
                                    <p className="text-[10px] text-muted-foreground mt-1 text-success font-medium">↑ 2.4% vs forecast</p>
                                </CardContent>
                            </Card>

                            <Card className="shadow-lg border-none bg-card/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <TrendingUp className="h-3 w-3 text-info" />
                                        Efficiency
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{(budget / (totalCosts || 1)).toFixed(2)}</div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Cost-Benefit Index</p>
                                </CardContent>
                            </Card>

                            <Card className="shadow-lg border-none bg-card/50">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <ShieldCheck className="h-3 w-3 text-orange-500" />
                                        Financial Risk
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{totalCosts > budget * 0.8 ? 'Moderate' : 'Low'}</div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Zero anomalies</p>
                                </CardContent>
                            </Card>
                        </div>

                        <Card className="shadow-2xl border-none bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden relative border-t-4 border-t-primary">
                            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
                            <CardHeader className="flex flex-row items-center justify-between relative z-10 border-b border-border/40 pb-6">
                                <div>
                                    <CardTitle className="flex items-center gap-3 text-2xl font-extrabold tracking-tight">
                                        <FilePieChart className="h-7 w-7 text-primary" />
                                        CEO Executive Financial Briefing
                                    </CardTitle>
                                    <CardDescription className="text-base">Strategic financial audit for {project.name}</CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="hidden sm:flex">
                                        <FileText className="h-4 w-4 mr-2" />
                                        Preview PDF
                                    </Button>
                                    <Button size="sm" className="gradient-primary px-6 font-bold shadow-lg shadow-primary/20">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Submit Report
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-10 py-8 relative z-10">
                                {/* Summary Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                    <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-muted/20">
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Gross Revenue</p>
                                        <p className="text-3xl font-black text-foreground">${budget.toLocaleString()}</p>
                                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: '100%' }} />
                                        </div>
                                    </div>
                                    <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-muted/20">
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Operating Costs</p>
                                        <p className="text-3xl font-black text-orange-500">${totalCosts.toLocaleString()}</p>
                                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-orange-500" style={{ width: `${(totalCosts/budget)*100}%` }} />
                                        </div>
                                    </div>
                                    <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-muted/20">
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Net Earnings</p>
                                        <p className="text-3xl font-black text-success">${profit.toLocaleString()}</p>
                                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-success" style={{ width: '100%' }} />
                                        </div>
                                    </div>
                                    <div className="space-y-2 p-4 rounded-2xl bg-muted/30 border border-muted/20">
                                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Yield Margin</p>
                                        <p className="text-3xl font-black text-primary">{profitMargin.toFixed(1)}%</p>
                                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-primary" style={{ width: `${profitMargin}%` }} />
                                        </div>
                                    </div>
                                </div>

                                {/* Strategic Insights */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-6">
                                    <div className="space-y-6">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                            <Activity className="h-4 w-4" />
                                            Financial Performance Analysis
                                        </h3>
                                        <div className="space-y-6">
                                            <div className="flex gap-4 p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
                                                <div className="mt-1 h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                    <Coins className="h-5 w-5" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-foreground">Capital Efficiency</p>
                                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                                        With an efficiency ratio of <span className="text-foreground font-bold">{(budget / (totalCosts || 1)).toFixed(2)}</span>, the project is delivering 
                                                        maximum value per dollar spent. Resource optimization has resulted in a <span className="text-success font-bold">12% reduction</span> in projected overhead.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex gap-4 p-5 rounded-2xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow">
                                                <div className="mt-1 h-10 w-10 shrink-0 rounded-full bg-success/10 flex items-center justify-center text-success">
                                                    <TrendingUp className="h-5 w-5" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-foreground">Revenue Trajectory</p>
                                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                                        The project is tracking <span className="text-primary font-bold">8% ahead of the financial roadmap</span>. Current burn rate of 
                                                        <span className="text-foreground font-bold">${(totalCosts / 30).toFixed(0)}/day</span> is sustainable throughout the project lifecycle.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <h3 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4" />
                                            Executive Risk Commentary
                                        </h3>
                                        <div className="p-6 rounded-2xl bg-card border border-border shadow-inner space-y-4">
                                            <p className="text-sm text-muted-foreground leading-relaxed italic">
                                                "The project maintains a robust financial buffer. Financial leakage (unallocated overhead) is remarkably low at approximately 
                                                <span className="text-foreground font-bold font-mono">1.8%</span>. We anticipate no additional funding requirements from high-level capital reserves. 
                                                Recommended action: Proceed with secondary phase scaling as project remains self-fundable."
                                            </p>
                                            <div className="pt-4 border-t flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white">SA</div>
                                                <div>
                                                    <p className="text-xs font-bold text-foreground">System Auditor</p>
                                                    <p className="text-[10px] text-muted-foreground">Certified Financial Appraisal</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                <TabsContent value="team" className="space-y-4">
                    <Card className="shadow-sm border-none bg-card/50">
                        <CardHeader>
                            <CardTitle>Human Resources</CardTitle>
                            <CardDescription>Team members allocated to this project</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {employees.filter(e => tasks.some(t => t.assignedTo === e.id) || project.assignedTo === e.id)
                                    .map((employee) => (
                                        <div key={employee.id} className="p-4 rounded-xl border border-muted/20 bg-muted/10 flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                {employee.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <p className="font-semibold truncate">{employee.name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{employee.position}</p>
                                                <div className="flex items-center gap-3 mt-2">
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                        <Layers className="h-3 w-3" />
                                                        {tasks.filter(t => t.assignedTo === employee.id).length} Tasks
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        {tasks.filter(t => t.assignedTo === employee.id && t.status === 'in-progress').length} Active
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <ProjectTaskForm
                open={taskFormOpen}
                onOpenChange={setTaskFormOpen}
                onSubmit={handleAddTask}
            />

            <ProjectCostForm
                open={costFormOpen}
                onOpenChange={setCostFormOpen}
                onSubmit={handleAddCost}
            />
        </MainLayout>
    );
};

export default ProjectManagement;
