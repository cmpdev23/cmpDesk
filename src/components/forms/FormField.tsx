/**
 * @file src/components/forms/FormField.tsx
 * @description Reusable form field wrapper with label and error display
 * 
 * Design System: NordVPN Inspired Dark Theme
 */

import { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

/**
 * Form field wrapper providing consistent styling for labels and error messages
 */
export function FormField({ label, htmlFor, required, error, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label 
        htmlFor={htmlFor}
        className="block text-sm font-medium text-text-secondary"
      >
        {label}
        {required && <span className="text-danger ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
