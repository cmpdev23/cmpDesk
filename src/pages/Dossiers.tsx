/**
 * @file src/pages/Dossiers.tsx
 * @description Page de création de dossier (Opportunity)
 *
 * Multi-step form for creating Opportunities in Salesforce.
 * 
 * Workflow:
 * - Step 1: Infos Compte (Account contact information)
 * - Step 1.5: Account Search Result (intermediate - shows search result)
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
  AccountSearchStep,
  OpportunityFormStep1,
  OpportunityFormStep2,
  DEFAULT_ACCOUNT_DATA,
  DEFAULT_STEP1_DATA,
  DEFAULT_STEP2_DATA,
  DossierPageHeader,
} from '@/modules/dossiers';
import type { 
  AccountStepData, 
  AccountSearchState, 
  OpportunityStep1Data, 
  CaseStep2Data,
  SearchStepStatus,
} from '@/modules/dossiers';
import type { AccountSearchResult } from '@/types/electron';
import { Button } from '@/components/ui/button';

// DEV mode flag — skip validation when true
const IS_DEV = import.meta.env.DEV;

/**
 * Form step types for the workflow
 * - 'account': Step 1 - Account contact form
 * - 'search-result': Step 1.5 - Intermediate search result step
 * - 'opportunity': Step 2 - Opportunity details
 * - 'case': Step 3 - Case/Product family details
 */
type FormStep = 'account' | 'search-result' | 'opportunity' | 'case';

/**
 * Get display step number for header (1, 2, or 3)
 */
function getDisplayStep(step: FormStep): number {
  switch (step) {
    case 'account':
    case 'search-result':
      return 1;
    case 'opportunity':
      return 2;
    case 'case':
      return 3;
  }
}

/**
 * Dossiers page - Multi-step form for opportunity creation
 */
function Dossiers() {
  // Current step navigation
  const [currentStep, setCurrentStep] = useState<FormStep>('account');

  // Form data state
  const [accountData, setAccountData] = useState<AccountStepData>(DEFAULT_ACCOUNT_DATA);
  const [step1Data, setStep1Data] = useState<OpportunityStep1Data>(DEFAULT_STEP1_DATA);
  const [step2Data, setStep2Data] = useState<CaseStep2Data>(DEFAULT_STEP2_DATA);

  // Account search state
  const [searchStatus, setSearchStatus] = useState<SearchStepStatus>('searching');
  const [searchResult, setSearchResult] = useState<AccountSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | undefined>();

  // Account selection state - stores which account to use
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

  // ─── Search Function ───────────────────────────────────────────────────────────

  /**
   * Perform account search when transitioning from account step to search-result
   */
  const performAccountSearch = async () => {
    setSearchStatus('searching');
    setSearchError(undefined);
    setSearchResult(null);
    setCurrentStep('search-result');

    try {
      const result = await window.electronAPI.salesforce.searchAccount({
        phone: accountData.phone || undefined,
        email: accountData.email || undefined,
        firstName: accountData.firstName || undefined,
        lastName: accountData.lastName || undefined,
      });

      setSearchResult(result);

      if (result.found) {
        setSearchStatus('found');
      } else if (result.error) {
        setSearchStatus('error');
        setSearchError(result.message || 'Erreur lors de la recherche');
      } else {
        setSearchStatus('not-found');
      }
    } catch (err) {
      setSearchStatus('error');
      setSearchError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  // ─── Navigation Handlers ──────────────────────────────────────────────────────

  const handleNext = () => {
    if (currentStep === 'account') {
      if (validateAccount()) {
        // Trigger search and show intermediate step
        performAccountSearch();
      }
    } else if (currentStep === 'opportunity') {
      if (validateStep1()) {
        setCurrentStep('case');
      }
    }
    // Note: 'search-result' step uses its own buttons, not the main Next button
  };

  const handlePrevious = () => {
    if (currentStep === 'search-result') {
      setCurrentStep('account');
    } else if (currentStep === 'opportunity') {
      // Go back to account step (skip search-result)
      setCurrentStep('account');
    } else if (currentStep === 'case') {
      setCurrentStep('opportunity');
    }
  };

  /**
   * Called when user chooses to use the found account
   */
  const handleUseAccount = () => {
    if (searchResult?.found && searchResult.accountId && searchResult.accountName) {
      setAccountSearchState({
        found: true,
        accountId: searchResult.accountId,
        accountName: searchResult.accountName,
        matchedBy: searchResult.matchedBy,
      });
      console.log('Using existing account:', searchResult.accountId);
    }
    setCurrentStep('opportunity');
  };

  /**
   * Called when user chooses to create a new account
   */
  const handleCreateNew = () => {
    setAccountSearchState({
      found: false,
      // Will create new account on submit
    });
    console.log('Will create new account');
    setCurrentStep('opportunity');
  };

  const handleSubmit = () => {
    // Final submission — validate all steps unless DEV mode
    const accountValid = validateAccount();
    const step1Valid = validateStep1();
    const step2Valid = validateStep2();

    if (!accountValid) {
      setCurrentStep('account');
      return;
    }
    if (!step1Valid) {
      setCurrentStep('opportunity');
      return;
    }
    if (!step2Valid) {
      setCurrentStep('case');
      return;
    }

    // TODO: Submit to Salesforce API
    console.log('Submitting form data:', { accountData, accountSearchState, step1Data, step2Data });
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

  // ─── Render ───────────────────────────────────────────────────────────────────

  const displayStep = getDisplayStep(currentStep);
  const isSearchResultStep = currentStep === 'search-result';

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <DossierPageHeader currentStep={displayStep} />

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
            
            {/* Step 1: Account Info Form */}
            {currentStep === 'account' && (
              <OpportunityFormStepCompte
                data={accountData}
                onChange={handleAccountChange}
                errors={accountErrors}
              />
            )}

            {/* Step 1.5: Search Result (intermediate) */}
            {currentStep === 'search-result' && (
              <AccountSearchStep
                status={searchStatus}
                searchResult={searchResult}
                errorMessage={searchError}
                onUseAccount={handleUseAccount}
                onCreateNew={handleCreateNew}
                onPrevious={() => setCurrentStep('account')}
              />
            )}

            {/* Step 2: Opportunity Details */}
            {currentStep === 'opportunity' && (
              <OpportunityFormStep1
                data={step1Data}
                onChange={handleStep1Change}
                errors={step1Errors}
              />
            )}

            {/* Step 3: Case/Product Family */}
            {currentStep === 'case' && (
              <OpportunityFormStep2
                data={step2Data}
                onChange={handleStep2Change}
                errors={step2Errors}
              />
            )}

            {/* Navigation buttons - hidden during search-result step (it has its own) */}
            {!isSearchResultStep && (
              <div className="flex justify-between mt-6">
                <Button
                  variant="secondary"
                  disabled={currentStep === 'account'}
                  onClick={handlePrevious}
                >
                  ← Précédent
                </Button>

                {currentStep === 'case' ? (
                  <Button onClick={handleSubmit}>Créer le dossier</Button>
                ) : (
                  <Button onClick={handleNext}>Suivant →</Button>
                )}
              </div>
            )}

            {/* Debug: Current form data (DEV only) */}
            {IS_DEV && (
              <details className="mt-8">
                <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                  Debug: Form Data
                </summary>
                <pre className="p-4 mt-2 overflow-auto text-xs rounded bg-muted text-muted-foreground">
                  {JSON.stringify({ currentStep, accountData, accountSearchState, step1Data, step2Data }, null, 2)}
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
