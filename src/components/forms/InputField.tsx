/**
 * @file src/components/forms/InputField.tsx
 * @description Styled text input for forms
 * 
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { ChangeEvent } from 'react';
import { cn } from '@/lib/utils';

interface InputFieldProps {
  id: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'email' | 'tel' | 'number' | 'date';
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: string | number;
  step?: string | number;
  className?: string;
}

/**
 * Styled text input matching the shadcn design system
 */
export function InputField({
  id,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled = false,
  required = false,
  min,
  step,
  className,
}: InputFieldProps) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      min={min}
      step={step}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
}
