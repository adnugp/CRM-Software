import React from 'react';
import { useWatch, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useSales } from '@/contexts/SalesContext';
import { SelectField, TextField } from '@/components/sales/fields';
import { NEW_COMPANY } from '@/components/sales/helpers';

/** Company select with a "+ New company" option that reveals a name box. */
export function CompanyPicker<T extends FieldValues>({ control }: { control: Control<T> }) {
  const { companies } = useSales();
  const companyId = useWatch({ control, name: 'companyId' as Path<T> });
  const options = [
    ...[...companies].sort((a, b) => a.name.localeCompare(b.name)).map(c => ({ value: c.id, label: c.name })),
    { value: NEW_COMPANY, label: '+ New company' },
  ];
  return (
    <>
      <SelectField control={control} name={'companyId' as Path<T>} label="Company" placeholder="Choose a company" options={options} />
      {companyId === NEW_COMPANY && <TextField control={control} name={'newCompanyName' as Path<T>} label="New company name" />}
    </>
  );
}
