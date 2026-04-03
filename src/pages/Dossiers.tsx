/**
 * @file src/pages/Dossiers.tsx
 * @description Page de création de dossier (Opportunity)
 *
 * Multi-step form for creating Opportunities in Salesforce.
 * Currently implements Step 1 - Informations générales.
 *
 * Design System: shadcn/ui (radix-lyra preset)
 *
 * @see docs/opportunity.md - Full field documentation
 */

import { useState } from 'react';
import { OpportunityFormStep1, DEFAULT_STEP1_DATA } from '@/modules/dossiers';
import type { OpportunityStep1Data } from '@/modules/dossiers';
import { Stepper } from '@/components/ui/stepper';
import { Button } from '@/components/ui/button';

/**
 * Dossiers page - Multi-step form for opportunity creation
 */
function Dossiers() {
  // Current step (for future multi-step navigation)
  const [currentStep] = useState(1);
  const totalSteps = 3; // Total steps as per docs/opportunity.md

  // Form data state for Step 1
  const [step1Data, setStep1Data] = useState<OpportunityStep1Data>(DEFAULT_STEP1_DATA);

  // Form errors (will be used for validation later)
  const [errors] = useState<Record<string, string>>({});

  // Handle form data changes
  const handleStep1Change = (data: OpportunityStep1Data) => {
    setStep1Data(data);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="p-2 border-b border-border bg-background">
        <div className="flex flex-col justify-between max-w-4xl gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-xl font-bold text-foreground">Nouveau dossier</h1>
          </div>

          <Stepper
            steps={[
              { title: 'Informations générales' },
              { title: 'Famille de produit' },
              { title: 'Type de signature' },
            ]}
            currentStep={currentStep}
          />
        </div>
      </div>

      {/* Form content area - scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="max-w-4xl">
            {/* Form card */}
            <div className="p-6 border rounded-lg bg-card border-border">
              {/* Step 1 form */}
              {currentStep === 1 && (
                <OpportunityFormStep1
                  data={step1Data}
                  onChange={handleStep1Change}
                  errors={errors}
                />
              )}

              {/* Placeholder for future steps */}
              {currentStep === 2 && (
                <div className="py-12 text-center text-muted-foreground">
                  Étape 2 — Famille de produit (à venir)
                </div>
              )}

              {currentStep === 3 && (
                <div className="py-12 text-center text-muted-foreground">
                  Étape 3 — Type de signature (à venir)
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between mt-6">
              <Button variant="secondary" disabled={currentStep === 1}>
                ← Précédent
              </Button>

              <Button>
                {currentStep === totalSteps ? 'Créer le dossier' : 'Suivant →'}
              </Button>
            </div>

            {/* Debug: Current form data (DEV only - will be removed) */}
            {import.meta.env.DEV && (
              <details className="mt-8">
                <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                  Debug: Form Data
                </summary>
                <pre className="p-4 mt-2 overflow-auto text-xs rounded bg-muted text-muted-foreground">
                  {JSON.stringify(step1Data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dossiers;
