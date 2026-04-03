/**
 * @file src/components/forms/SelectField.tsx
 * @description Styled select dropdown for forms
 * 
 * Design System: NordVPN Inspired Dark Theme
 */

import { ChangeEvent } from 'react';
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
}

/**
 * Styled select dropdown matching the dark theme
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
}: SelectFieldProps) {
  return (
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      required={required}
      className={`
        w-full px-3 py-2 rounded-md
        bg-surface-light border border-border
        text-text-primary
        focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
        appearance-none
        cursor-pointer
      `}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239FB0C3'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.5rem center',
        backgroundSize: '1.5em 1.5em',
        paddingRight: '2.5rem',
      }}
    >
      <option value="" disabled>
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
