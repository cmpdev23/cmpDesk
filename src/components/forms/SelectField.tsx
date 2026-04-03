/**
 * @file src/components/forms/SelectField.tsx
 * @description Styled select dropdown for forms — wraps shadcn/ui Select
 *
 * Design System: shadcn/ui (radix-lyra preset)
 *
 * API note: shadcn Select uses `onValueChange: (value: string) => void`
 * (Radix UI), NOT a DOM ChangeEvent. Callers must use onValueChange.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PicklistOption } from '../../lib/opportunity/picklists';

interface SelectFieldProps {
  id: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  options: PicklistOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Thin wrapper around shadcn Select, mapping PicklistOption[] to SelectItems.
 * No extra styling — design system handles appearance via CSS variables.
 */
export function SelectField({
  id,
  name,
  value,
  onValueChange,
  options,
  placeholder = 'Sélectionner...',
  disabled = false,
}: SelectFieldProps) {
  return (
    <Select
      name={name}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
