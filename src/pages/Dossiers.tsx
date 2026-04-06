/**
 * @file src/pages/Dossiers.tsx
 * @description Page de création de dossier (Opportunity)
 *
 * Multi-step form for creating Opportunities in Salesforce.
 * - Step 1: Infos Compte (Account contact information)
 * - Step 2: Informations générales (Opportunity)
 * - Step 3: Famille de produit (Case)
 *
 * DEV MODE: Validation is bypassed — can navigate freely between steps.
 *
 * Design System: shadcn/ui (radix-lyra preset)
 *
 * @see docs/opportunity.md - Opportunity field documentation
 * @see docs/Case.md - Case field documentation
 */

import { useState } from 'react';
import {
  OpportunityFormStepCompte,
  OpportunityFormStep1,
  OpportunityFormStep2,
  DEFAULT_ACCOUNT_DATA,
  DEFAULT_STEP1_DATA,
  DEFAULT_STEP2_DATA,
  DossierPageHeader,
} from '@/modules/dossiers';
import type { AccountStepData, AccountSearchState, OpportunityStep1Data, CaseStep2Data } from '@/modules/dossiers';
import { Button } from '@/components/ui/button';

// DEV mode flag — skip validation when true
const IS_DEV = import.meta.env.DEV;

/**
 * Dossiers page - Multi-step form for opportunity creation
 */
function Dossiers() {
  // Current step navigation
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3; // Total steps as per docs

  // Form data state
  const [accountData, setAccountData] = useState<AccountStepData>(DEFAULT_ACCOUNT_DATA);
  const [step1Data, setStep1Data] = useState<OpportunityStep1Data>(DEFAULT_STEP1_DATA);
  const [step2Data, setStep2Data] = useState<CaseStep2Data>(DEFAULT_STEP2_DATA);

  // Account search state - stores result of Salesforce account search
  const [accountSearchState, setAccountSearchState] = useState<AccountSearchState | null>(null);

  // Form errors (will be used for validation)
  const [accountErrors, setAccountErrors] = useState<Record<string, string>>({});
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});

  // ─── Validation Functions ─────────────────────────────────────────────────────

  /**
   * Validate Account step required fields.
   * Returns true if valid or in DEV mode.
   */
  const validateAccount = (): boolean => {
    if (IS_DEV) return true; // Skip validation in DEV mode

    const errors: Record<string, string> = {};

    if (!accountData.firstName) {
      errors.firstName = 'Le prénom est requis';
    }
    if (!accountData.lastName) {
      errors.lastName = 'Le nom est requis';
    }

    setAccountErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Validate Step 1 required fields (Informations générales).
   * Returns true if valid or in DEV mode.
   */
  const validateStep1 = (): boolean => {
    if (IS_DEV) return true; // Skip validation in DEV mode

    const errors: Record<string, string> = {};

    if (!step1Data.opportunityCategory) {
      errors.opportunityCategory = 'La catégorie est requise';
    }
    if (!step1Data.subsidiary) {
      errors.subsidiary = 'La filiale est requise';
    }

    setStep1Errors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Validate Step 2 required fields (Famille de produit).
   * Returns true if valid or in DEV mode.
   */
  const validateStep2 = (): boolean => {
    if (IS_DEV) return true; // Skip validation in DEV mode

    const errors: Record<string, string> = {};

    if (!step2Data.productFamily) {
      errors.productFamily = 'La famille de produit est requise';
    }
    if (!step2Data.transactionCategory) {
      errors.transactionCategory = 'La catégorie de transaction est requise';
    }

    setStep2Errors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── Navigation Handlers ──────────────────────────────────────────────────────

  const handleNext = () => {
    let isValid = true;

    // Validate current step (unless DEV mode)
    if (currentStep === 1) {
      isValid = validateAccount();
    } else if (currentStep === 2) {
      isValid = validateStep1();
    } else if (currentStep === 3) {
      isValid = validateStep2();
    }

    if (isValid && currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    // Final submission — validate all steps unless DEV mode
    const accountValid = validateAccount();
    const step1Valid = validateStep1();
    const step2Valid = validateStep2();

    if (!accountValid) {
      setCurrentStep(1);
      return;
    }
    if (!step1Valid) {
      setCurrentStep(2);
      return;
    }
    if (!step2Valid) {
      setCurrentStep(3);
      return;
    }

    // TODO: Submit to Salesforce API
    console.log('Submitting form data:', { accountData, step1Data, step2Data });
  };

  // ─── Form Data Handlers ───────────────────────────────────────────────────────

  const handleAccountChange = (data: AccountStepData) => {
    setAccountData(data);
    // Clear errors when user modifies data
    if (Object.keys(accountErrors).length > 0) {
      setAccountErrors({});
    }
    // Reset account search state when user modifies contact data
    if (accountSearchState) {
      setAccountSearchState(null);
    }
  };

  /**
   * Called when an account is found via Salesforce search.
   * Stores the account ID for use during Opportunity creation.
   */
  const handleAccountFound = (accountId: string, accountName: string) => {
    setAccountSearchState({
      found: true,
      accountId,
      accountName,
    });
    console.log('Account found:', { accountId, accountName });
  };

  const handleStep1Change = (data: OpportunityStep1Data) => {
    setStep1Data(data);
    // Clear errors when user modifies data
    if (Object.keys(step1Errors).length > 0) {
      setStep1Errors({});
    }
  };

  const handleStep2Change = (data: CaseStep2Data) => {
    setStep2Data(data);
    // Clear errors when user modifies data
    if (Object.keys(step2Errors).length > 0) {
      setStep2Errors({});
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <DossierPageHeader currentStep={currentStep} />

      {/* DEV mode indicator */}
      {IS_DEV && (
        <div className="px-6 py-1 text-xs font-medium text-center text-amber-800 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200">
          Mode DEV — Validation désactivée
        </div>
      )}

      {/* Form content area - scrollable */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="max-w-4xl">
            {/* Step forms — each step component owns its Card container */}
            {currentStep === 1 && (
              <OpportunityFormStepCompte
                data={accountData}
                onChange={handleAccountChange}
                errors={accountErrors}
                onAccountFound={handleAccountFound}
              />
            )}

            {currentStep === 2 && (
              <OpportunityFormStep1
                data={step1Data}
                onChange={handleStep1Change}
                errors={step1Errors}
              />
            )}

            {currentStep === 3 && (
              <OpportunityFormStep2
                data={step2Data}
                onChange={handleStep2Change}
                errors={step2Errors}
              />
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-6">
              <Button
                variant="secondary"
                disabled={currentStep === 1}
                onClick={handlePrevious}
              >
                ← Précédent
              </Button>

              {currentStep === totalSteps ? (
                <Button onClick={handleSubmit}>Créer le dossier</Button>
              ) : (
                <Button onClick={handleNext}>Suivant →</Button>
              )}
            </div>

            {/* Debug: Current form data (DEV only) */}
            {IS_DEV && (
              <details className="mt-8">
                <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                  Debug: Form Data
                </summary>
                <pre className="p-4 mt-2 overflow-auto text-xs rounded bg-muted text-muted-foreground">
                  {JSON.stringify({ accountData, accountSearchState, step1Data, step2Data }, null, 2)}
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
