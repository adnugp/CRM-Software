import React, { useState, useMemo } from 'react';
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
    ArrowLeft
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

const ProjectManagement: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { projects, employees, updateProject } = useData();
    const [activeTab, setActiveTab] = useState('overview');
    const [taskFormOpen, setTaskFormOpen] = useState(false);
    const [costFormOpen, setCostFormOpen] = useState(false);
    const [showAssigneeCount, setShowAssigneeCount] = useState(false);

    const project = projects.find(p => p.id === id);

    const totalProjectsForAssignee = useMemo(() => {
        if (!project) return 0;
        return projects.filter(p => p.assignedTo === project.assignedTo).length;
    }, [projects, project?.assignedTo]);

    if (!project) {
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
                        Project ID: {project.id} • {project.company}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <StatusBadge status={project.status} variant="project" />
                    <Button className="gradient-primary text-white" onClick={() => setTaskFormOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Task
                    </Button>
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
                    <TabsTrigger value="tasks" className="data-[state=active]:bg-background">Tasks & Productivity</TabsTrigger>
                    <TabsTrigger value="financials" className="data-[state=active]:bg-background">Financial Linkage</TabsTrigger>
                    <TabsTrigger value="team" className="data-[state=active]:bg-background">Team & HR</TabsTrigger>
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
                    </div>
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
