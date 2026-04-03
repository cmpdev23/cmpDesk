import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  title: string;
  description?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isCompleted = stepNumber < currentStep;
        const isCurrent = stepNumber === currentStep;

        return (
          <React.Fragment key={step.title}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium transition-colors border",
                  isCurrent
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCompleted
                    ? "bg-chart-2 border-chart-2 text-primary-foreground"
                    : "bg-accent border-border text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : stepNumber}
              </div>
              <span
                className={cn(
                  "text-sm hidden sm:inline-block",
                  isCurrent
                    ? "text-primary font-medium"
                    : isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "w-4 sm:w-8 h-[1px]",
                  isCompleted ? "bg-chart-2" : "bg-border"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
