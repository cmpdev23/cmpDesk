/**
 * @file src/components/forms/InputField.tsx
 * @description Styled text input for forms — wraps shadcn/ui Input
 *
 * Design System: shadcn/ui (radix-lyra preset)
 * No extra styling — design system handles appearance via CSS variables.
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
