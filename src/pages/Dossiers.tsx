/**
 * @file src/pages/Dossiers.tsx
 * @description Page de création de dossier (Opportunity)
 * 
 * Multi-step form for creating Opportunities in Salesforce.
 * Currently implements Step 1 - Informations générales.
 * 
 * Design System: NordVPN Inspired Dark Theme
 * 
 * @see docs/opportunity.md - Full field documentation
 */

import { useState } from 'react';
import { OpportunityFormStep1 } from '../components/dossiers';
import { DEFAULT_STEP1_DATA } from '../lib/opportunity/types';
import type { OpportunityStep1Data } from '../lib/opportunity/types';

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
    <div className="h-full flex flex-col">
      {/* Page header */}
      <div className="p-6 border-b border-border bg-surface">
        <div className="max-w-4xl">
          <h1 className="text-2xl font-bold text-text-primary">
            Nouveau dossier
          </h1>
          <p className="mt-1 text-text-secondary">
            Créer une nouvelle opportunité dans Salesforce
          </p>
          
          {/* Step indicator */}
          <div className="mt-4 flex items-center gap-2">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
              <div key={step} className="flex items-center">
                {/* Step circle */}
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${step === currentStep
                      ? 'bg-primary text-white'
                      : step < currentStep
                        ? 'bg-success text-white'
                        : 'bg-surface-light text-text-muted border border-border'
                    }
                  `}
                >
                  {step < currentStep ? '✓' : step}
                </div>
                
                {/* Connector line */}
                {step < totalSteps && (
                  <div
                    className={`
                      w-12 h-0.5 mx-2
                      ${step < currentStep ? 'bg-success' : 'bg-border'}
                    `}
                  />
                )}
              </div>
            ))}
          </div>
          
          {/* Step labels */}
          <div className="mt-2 flex items-center text-xs text-text-muted">
            <span className={currentStep === 1 ? 'text-primary font-medium' : ''}>
              Informations générales
            </span>
            <span className="mx-6">Famille de produit</span>
            <span>Type de signature</span>
          </div>
        </div>
      </div>

      {/* Form content area - scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="max-w-4xl">
            {/* Form card */}
            <div className="bg-surface rounded-lg border border-border p-6">
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
                <div className="text-center py-12 text-text-muted">
                  Étape 2 — Famille de produit (à venir)
                </div>
              )}
              
              {currentStep === 3 && (
                <div className="text-center py-12 text-text-muted">
                  Étape 3 — Type de signature (à venir)
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                disabled={currentStep === 1}
                className={`
                  px-4 py-2 rounded transition-colors
                  ${currentStep === 1
                    ? 'bg-surface-light text-text-muted cursor-not-allowed'
                    : 'bg-surface hover:bg-surface-light text-text-secondary border border-border'
                  }
                `}
              >
                ← Précédent
              </button>
              
              <button
                type="button"
                className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded transition-colors font-medium"
              >
                {currentStep === totalSteps ? 'Créer le dossier' : 'Suivant →'}
              </button>
            </div>

            {/* Debug: Current form data (DEV only - will be removed) */}
            {import.meta.env.DEV && (
              <details className="mt-8">
                <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
                  Debug: Form Data
                </summary>
                <pre className="mt-2 p-4 bg-surface-light rounded text-xs text-text-muted overflow-auto">
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
