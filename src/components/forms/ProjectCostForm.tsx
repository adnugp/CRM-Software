import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { ProjectCost } from '@/types';

const costSchema = z.object({
    description: z.string().min(1, 'Description is required').max(100, 'Description must be less than 100 characters'),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0'),
    date: z.string().min(1, 'Date is required'),
    category: z.string().min(1, 'Category is required').max(200, 'Category must be less than 200 characters'),
});

type CostFormData = z.infer<typeof costSchema>;

interface ProjectCostFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: CostFormData) => void;
    cost?: ProjectCost | null;
}

const ProjectCostForm: React.FC<ProjectCostFormProps> = ({
    open,
    onOpenChange,
    onSubmit,
    cost,
}) => {
    const isEditing = !!cost;

    const form = useForm<CostFormData>({
        resolver: zodResolver(costSchema),
        defaultValues: {
            description: cost?.description || '',
            amount: cost?.amount || 0,
            date: cost?.date || '',
            category: cost?.category || '',
        },
    });

    React.useEffect(() => {
        if (cost) {
            form.reset({
                description: cost.description,
                amount: cost.amount,
                date: cost.date,
                category: cost.category,
            });
        } else {
            form.reset({
                description: '',
                amount: 0,
                date: '',
                category: '',
            });
        }
    }, [cost, form]);

    const handleSubmit = (data: CostFormData) => {
        onSubmit(data);
        onOpenChange(false);
        form.reset();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Input placeholder="What was this expense for?" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount ($)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="date"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Enter expense category (e.g., Labor, Material, Software, Travel, etc.)"
                                            className="resize-none"
                                            rows={2}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="gradient-primary text-white">
                                {isEditing ? 'Update Expense' : 'Add Expense'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectCostForm;
