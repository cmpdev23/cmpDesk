/**
 * @file src/components/ui/select-field.tsx
 * @description Generic styled select dropdown — wraps shadcn/ui Select
 *
 * Reusable across all modules. No business logic, no domain coupling.
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

/**
 * Generic picklist option — value sent to API, label shown in UI.
 * Exported so modules can type their options arrays without coupling to a domain.
 */
export interface PicklistOption {
  value: string;
  label: string;
}

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
 * Use this in any module form — it is module-agnostic.
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
