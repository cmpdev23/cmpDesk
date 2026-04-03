/**
 * @file src/components/ui/form-field.tsx
 * @description Generic form field wrapper with label and error display
 *
 * Reusable across all modules. Provides consistent label + error styling.
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
 * Form field wrapper providing consistent styling for labels and error messages.
 * Use this in any module form — it is module-agnostic.
 */
export function FormField({
  label,
  htmlFor,
  required,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
