/**
 * @file src/components/forms/InputField.tsx
 * @description Styled text input for forms
 * 
 * Design System: NordVPN Inspired Dark Theme
 */

import { ChangeEvent } from 'react';

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
}

/**
 * Styled text input matching the dark theme
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
      className={`
        w-full px-3 py-2 rounded-md
        bg-surface-light border border-border
        text-text-primary placeholder-text-muted
        focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
      `}
    />
  );
}
