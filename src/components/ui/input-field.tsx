/**
 * @file src/components/ui/input-field.tsx
 * @description Generic styled text input — wraps shadcn/ui Input
 *
 * Reusable across all modules. No business logic, no domain coupling.
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';

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
 * Thin wrapper around shadcn Input, forwarding all standard props.
 * Use this in any module form — it is module-agnostic.
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
    <Input
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
      className={className}
    />
  );
}
