import React from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
}

export function TextField<T extends FieldValues>({ control, name, label, placeholder, type = 'text', multiline }: FieldProps<T> & { type?: string; multiline?: boolean }) {
  return (
    <FormField control={control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          {multiline
            ? <Textarea rows={3} placeholder={placeholder} {...field} value={field.value ?? ''} />
            : <Input type={type} placeholder={placeholder} {...field} value={field.value ?? ''} />}
        </FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}

export function SelectField<T extends FieldValues>({ control, name, label, placeholder, options }: FieldProps<T> & { options: { value: string; label: string }[] }) {
  return (
    <FormField control={control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select onValueChange={field.onChange} value={field.value || undefined}>
          <FormControl>
            <SelectTrigger><SelectValue placeholder={placeholder ?? 'Select'} /></SelectTrigger>
          </FormControl>
          <SelectContent>
            {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  );
}
