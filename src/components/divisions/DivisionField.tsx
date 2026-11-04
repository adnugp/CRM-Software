import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface DivisionFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
}

/**
 * "Division" select for record forms. Renders nothing when the company has no
 * divisions, so single-business customers never see the concept.
 */
export function DivisionField<T extends FieldValues>({ control, name }: DivisionFieldProps<T>) {
  const { divisions } = useWorkspace();
  if (divisions.length === 0) return null;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>Division</FormLabel>
          <Select onValueChange={field.onChange} value={field.value || undefined}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {divisions.map(division => (
                <SelectItem key={division.id} value={division.id}>
                  {division.name} ({division.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
