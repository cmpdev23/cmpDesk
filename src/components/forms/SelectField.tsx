/**
 * @file src/components/forms/SelectField.tsx
 * @description Styled select dropdown for forms
 * 
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { ChangeEvent } from 'react';
import { cn } from '@/lib/utils';
import type { PicklistOption } from '../../lib/opportunity/picklists';

interface SelectFieldProps {
  id: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: PicklistOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * Styled select dropdown matching the shadcn design system
 */
export function SelectField({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Sélectionner...',
  disabled = false,
  required = false,
  className,
}: SelectFieldProps) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "appearance-none cursor-pointer pr-10",
        className
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.5rem center',
        backgroundSize: '1.25em 1.25em',
      }}
    >
      <option value="" disabled className="text-muted-foreground">
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
