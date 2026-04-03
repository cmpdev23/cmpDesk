/**
 * @file src/components/forms/FormField.tsx
 * @description Reusable form field wrapper with label and error display
 * 
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Form field wrapper providing consistent styling for labels and error messages
 */
export function FormField({ 
  label, 
  htmlFor, 
  required, 
  error, 
  children,
  className 
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label 
        htmlFor={htmlFor}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
