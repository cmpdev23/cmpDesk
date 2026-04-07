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
  DocumentUploadStep,
  NotesStep,
  DEFAULT_ACCOUNT_DATA,
  DEFAULT_STEP1_DATA,
  DEFAULT_STEP2_DATA,
  DEFAULT_DOCUMENT_UPLOAD_DATA,
  DEFAULT_NOTES_DATA,
  DossierPageHeader,
} from '@/modules/dossiers';
import type {
  AccountStepData,
  AccountSearchState,
  OpportunityStep1Data,
  CaseStep2Data,
  DocumentUploadStepData,
  NotesStepData,
  SearchStepStatus,
} from '@/modules/dossiers';
import type { AccountSearchResult, CreateDossierResult, UploadDocumentsResult, CreateNoteResult } from '@/types/electron';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useDevMode } from '@/hooks/use-dev-mode';

/**
 * Form step types for the workflow
 * - 'account': Step 1 - Account contact form
 * - 'search-result': Step 1.5 - Intermediate search result step
 * - 'opportunity': Step 2 - Opportunity details
 * - 'case': Step 3 - Case/Product family details
 * - 'documents': Step 4 - Document upload
 * - 'notes': Step 5 - Notes
 */
type FormStep = 'account' | 'search-result' | 'opportunity' | 'case' | 'documents' | 'notes';

/**
 * Get display step number for header (1, 2, 3, 4, or 5)
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
    case 'documents':
      return 4;
    case 'notes':
      return 5;
  }
}

/**
 * Dossiers page - Multi-step form for opportunity creation
 */
function Dossiers() {
  // DEV mode hook - for validation bypass and debug features
  const { isDevMode, shouldBypassValidation, shouldEnableNextButton } = useDevMode();

  // Current step navigation
  const [currentStep, setCurrentStep] = useState<FormStep>('account');

  // Form data state
  const [accountData, setAccountData] = useState<AccountStepData>(DEFAULT_ACCOUNT_DATA);
  const [step1Data, setStep1Data] = useState<OpportunityStep1Data>(DEFAULT_STEP1_DATA);
  const [step2Data, setStep2Data] = useState<CaseStep2Data>(DEFAULT_STEP2_DATA);
  const [documentData, setDocumentData] = useState<DocumentUploadStepData>(DEFAULT_DOCUMENT_UPLOAD_DATA);
  const [notesData, setNotesData] = useState<NotesStepData>(DEFAULT_NOTES_DATA);

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

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<CreateDossierResult | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadDocumentsResult | null>(null);
  const [noteResult, setNoteResult] = useState<CreateNoteResult | null>(null);

  // Account creation state
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [createAccountError, setCreateAccountError] = useState<string | undefined>();

  // ─── Validation Functions ─────────────────────────────────────────────────────

  /**
   * Validate Account step required fields.
   * Returns true if valid or if DEV mode bypass applies (empty form in DEV).
   */
  const validateAccount = (): boolean => {
    // DEV mode bypass: skip validation if form is completely empty
    if (shouldBypassValidation(accountData)) return true;

    const errors: Record<string, string> = {};

    if (!accountData.firstName) {
      errors.firstName = 'Le prénom est requis';
    }
    if (!accountData.lastName) {
      errors.lastName = 'Le nom est requis';
    }
    if (!accountData.phone) {
      errors.phone = 'Le téléphone est requis';
    }
    if (!accountData.email) {
      errors.email = 'L\'email est requis';
    }

    setAccountErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Check if Account step required fields are filled (for button state)
   */
  const isAccountStepComplete = (): boolean => {
    return Boolean(
      accountData.firstName?.trim() &&
      accountData.lastName?.trim() &&
      accountData.phone?.trim() &&
      accountData.email?.trim()
    );
  };

  /**
   * Validate Step 1 required fields (Informations générales).
   * Returns true if valid or if DEV mode bypass applies (empty form in DEV).
   */
  const validateStep1 = (): boolean => {
    // DEV mode bypass: skip validation if form is completely empty
    if (shouldBypassValidation(step1Data)) return true;

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
   * Returns true if valid or if DEV mode bypass applies (empty form in DEV).
   */
  const validateStep2 = (): boolean => {
    // DEV mode bypass: skip validation if form is completely empty
    if (shouldBypassValidation(step2Data)) return true;

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
        // Check if multiple results returned
        if (result.multipleResults && result.candidates && result.candidates.length > 1) {
          setSearchStatus('multiple');
        } else {
          setSearchStatus('found');
        }
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
      // DEV mode bypass: skip search if form is completely empty (inspection mode)
      if (shouldBypassValidation(accountData)) {
        // Skip search step entirely - go straight to opportunity form
        setCurrentStep('opportunity');
        return;
      }
      
      if (validateAccount()) {
        // Normal flow: Trigger search and show intermediate step
        performAccountSearch();
      }
    } else if (currentStep === 'opportunity') {
      if (validateStep1()) {
        setCurrentStep('case');
      }
    } else if (currentStep === 'case') {
      if (validateStep2()) {
        setCurrentStep('documents');
      }
    } else if (currentStep === 'documents') {
      // No validation needed for documents - proceed to notes
      setCurrentStep('notes');
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
    } else if (currentStep === 'documents') {
      setCurrentStep('case');
    } else if (currentStep === 'notes') {
      setCurrentStep('documents');
    }
  };

  /**
   * Called when user chooses to use the found account
   * @param accountId - Optional account ID (used when selecting from multiple results)
   * @param accountName - Optional account name (used when selecting from multiple results)
   */
  const handleUseAccount = (accountId?: string, accountName?: string) => {
    // If accountId is provided (from multiple selection), use it
    // Otherwise fallback to the single searchResult
    const finalAccountId = accountId || searchResult?.accountId;
    const finalAccountName = accountName || searchResult?.accountName;
    
    if (finalAccountId && finalAccountName) {
      setAccountSearchState({
        found: true,
        accountId: finalAccountId,
        accountName: finalAccountName,
        matchedBy: searchResult?.matchedBy,
      });
      console.log('Using existing account:', finalAccountId);
    }
    setCurrentStep('opportunity');
  };

  /**
   * Called when user chooses to create a new account.
   * Creates the account in Salesforce and then proceeds to next step.
   */
  const handleCreateNew = async () => {
    // Validate we have required data
    if (!accountData.lastName) {
      setCreateAccountError('Le nom de famille est requis pour créer un compte');
      return;
    }

    setIsCreatingAccount(true);
    setCreateAccountError(undefined);
    console.log('Creating new account with:', accountData);

    try {
      const result = await window.electronAPI.salesforce.createAccount({
        firstName: accountData.firstName || undefined,
        lastName: accountData.lastName,
        phone: accountData.phone || undefined,
        email: accountData.email || undefined,
      });

      if (result.success && result.accountId) {
        // Account created successfully
        console.log('Account created:', result.accountId, result.accountName);
        
        setAccountSearchState({
          found: true,
          accountId: result.accountId,
          accountName: result.accountName || `${accountData.firstName} ${accountData.lastName}`,
          isNewAccount: true,
        });
        
        setCurrentStep('opportunity');
      } else {
        // Creation failed
        console.error('Account creation failed:', result.error);
        setCreateAccountError(result.error || result.message || 'Erreur lors de la création du compte');
      }
    } catch (err) {
      console.error('Account creation error:', err);
      setCreateAccountError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const handleSubmit = async () => {
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

    // Check that we have an account to use (existing account workflow only for now)
    if (!accountSearchState?.found || !accountSearchState?.accountId) {
      console.error('No account selected - cannot create dossier');
      return;
    }

    // Start submission
    setIsSubmitting(true);
    setSubmitResult(null);
    setUploadResult(null);
    setNoteResult(null);

    console.log('Submitting form data:', { accountData, accountSearchState, step1Data, step2Data, documentData, notesData });

    try {
      // ── Step 1: Create Opportunity + Case ─────────────────────────────────────
      const result = await window.electronAPI.salesforce.createDossier({
        accountId: accountSearchState.accountId,
        opportunityData: {
          opportunityCategory: step1Data.opportunityCategory,
          productInterest: step1Data.productInterest,
          subsidiary: step1Data.subsidiary,
          proposalNumber: step1Data.proposalNumber,
          contractNumber: step1Data.contractNumber,
          transactionDate: step1Data.transactionDate,
          annualPremium: step1Data.annualPremium,
        },
        caseData: {
          productFamily: step2Data.productFamily,
          transactionCategory: step2Data.transactionCategory,
          transactionSubCategory: step2Data.transactionSubCategory,
          signatureType: step2Data.signatureType,
          customersPlaceOfResidence: step2Data.customersPlaceOfResidence,
          productType: step2Data.productType,
        },
      });

      console.log('Dossier creation result:', result);
      setSubmitResult(result);

      // ── Step 2: Upload documents (if any and Case was created) ────────────────
      if (result.success && result.caseId && documentData.files.length > 0) {
        console.log('Uploading documents to Case:', result.caseId);

        // Wait 2 seconds for OpenText workspace to be ready
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Convert File objects to serializable format
        const filesForUpload = await Promise.all(
          documentData.files.map(async (f) => {
            const arrayBuffer = await f.file.arrayBuffer();
            return {
              name: f.name,
              type: f.type,
              size: f.size,
              buffer: Array.from(new Uint8Array(arrayBuffer)),
            };
          })
        );

        const uploadRes = await window.electronAPI.salesforce.uploadDocuments({
          caseId: result.caseId,
          files: filesForUpload,
        });

        console.log('Document upload result:', uploadRes);
        setUploadResult(uploadRes);
      }

      // ── Step 3: Create note (if notes content exists and Case was created) ────
      if (result.success && result.caseId && notesData.notes && notesData.notes.trim().length > 0) {
        console.log('Creating note for Case:', result.caseId);

        const noteRes = await window.electronAPI.salesforce.createNote({
          caseId: result.caseId,
          title: 'Note du dossier',
          content: notesData.notes,
        });

        console.log('Note creation result:', noteRes);
        setNoteResult(noteRes);
      }
    } catch (err) {
      console.error('Dossier creation error:', err);
      setSubmitResult({
        success: false,
        error: err instanceof Error ? err.message : 'Erreur inconnue',
      });
    } finally {
      setIsSubmitting(false);
    }
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
    // Smart pre-fill: when opportunityCategory changes to "Insurance",
    // auto-select productInterest = "Life Insurance" (Step 2)
    // and pre-populate productFamily = "Insurance" in Step 3 (case form)
    if (
      data.opportunityCategory === 'Insurance' &&
      step1Data.opportunityCategory !== 'Insurance'
    ) {
      // Auto-select productInterest in this step
      data = { ...data, productInterest: 'Life Insurance' };

      // Pre-populate Step 3 productFamily (reset cascade children)
      setStep2Data((prev) => ({
        ...prev,
        productFamily: 'Insurance',
        transactionCategory: '',
        transactionSubCategory: '',
        signatureType: '',
        productType: '',
      }));
    }

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
      {isDevMode && (
        <div className="px-6 py-1 text-xs font-medium text-center text-amber-800 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-200">
          Mode DEV — Navigation libre (validation bypass si formulaire vide)
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
                isCreating={isCreatingAccount}
                createError={createAccountError}
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

            {/* Step 4: Document Upload */}
            {currentStep === 'documents' && (
              <DocumentUploadStep
                data={documentData}
                onChange={setDocumentData}
              />
            )}

            {/* Step 5: Notes */}
            {currentStep === 'notes' && (
              <NotesStep
                data={notesData}
                onChange={setNotesData}
              />
            )}

            {/* Submission Result */}
            {submitResult && (
              <Card className={`mt-6 pl-1 border ${
                submitResult.success && (!uploadResult || uploadResult.success)
                  ? 'border-green-200 dark:border-green-900'
                  : submitResult.success && uploadResult && !uploadResult.success
                    ? 'border-amber-200 dark:border-amber-900'
                    : 'border-red-200 dark:border-red-900'
              }`}>
                <CardHeader>
                  <CardTitle className={
                    submitResult.success && (!uploadResult || uploadResult.success)
                      ? 'text-green-700 dark:text-green-400'
                      : submitResult.success && uploadResult && !uploadResult.success
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-red-700 dark:text-red-400'
                  }>
                    {submitResult.success
                      ? uploadResult && !uploadResult.success
                        ? '⚠️ Dossier créé (upload partiel)'
                        : '✅ Dossier créé avec succès'
                      : '❌ Erreur lors de la création'
                    }
                  </CardTitle>
                  <CardDescription>
                    {submitResult.success
                      ? 'L\'Opportunity et le Case ont été créés dans Salesforce'
                      : submitResult.error
                    }
                  </CardDescription>
                </CardHeader>
                {submitResult.success && (
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Opportunity ID:</span>
                        <code className="px-2 py-0.5 text-xs rounded bg-muted">{submitResult.opportunityId}</code>
                      </div>
                      {submitResult.caseId && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">Case ID:</span>
                          <code className="px-2 py-0.5 text-xs rounded bg-muted">{submitResult.caseId}</code>
                        </div>
                      )}
                      {submitResult.warning && (
                        <p className="text-sm text-amber-600 dark:text-amber-400">
                          ⚠️ {submitResult.warning}
                        </p>
                      )}
                    </div>

                    {/* Document Upload Results */}
                    {uploadResult && (
                      <div className="pt-4 border-t border-border">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-sm font-medium">📄 Documents:</span>
                          <span className={`text-sm ${
                            uploadResult.success
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            {uploadResult.uploadedCount}/{uploadResult.uploadedCount + uploadResult.failedCount} uploadés
                          </span>
                        </div>

                        <div className="space-y-1">
                          {uploadResult.results.map((fileResult, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span className={fileResult.success ? 'text-green-600' : 'text-red-600'}>
                                {fileResult.success ? '✓' : '✗'}
                              </span>
                              <span className={fileResult.success ? 'text-foreground' : 'text-red-600 dark:text-red-400'}>
                                {fileResult.fileName}
                              </span>
                              {fileResult.error && (
                                <span className="text-xs text-muted-foreground">
                                  — {fileResult.error}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {uploadResult.error && uploadResult.failedCount > 0 && (
                          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                            {uploadResult.error}
                          </p>
                        )}
                      </div>
                    )}

                    {/* No documents case */}
                    {!uploadResult && documentData.files.length === 0 && (
                      <div className="pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                          📄 Aucun document uploadé
                        </p>
                      </div>
                    )}

                    {/* Note Result */}
                    {noteResult && (
                      <div className="pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">📝 Note:</span>
                          <span className={`text-sm ${
                            noteResult.success
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}>
                            {noteResult.success ? 'Ajoutée' : 'Échec'}
                          </span>
                        </div>
                        {noteResult.warning && (
                          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                            ⚠️ {noteResult.warning}
                          </p>
                        )}
                        {noteResult.error && !noteResult.success && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {noteResult.error}
                          </p>
                        )}
                      </div>
                    )}

                    {/* No notes case */}
                    {!noteResult && (!notesData.notes || notesData.notes.trim().length === 0) && (
                      <div className="pt-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                          📝 Aucune note ajoutée
                        </p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            )}

            {/* Navigation buttons - hidden during search-result step (it has its own) */}
            {!isSearchResultStep && !submitResult?.success && (
              <div className="flex justify-between mt-6">
                <Button
                  variant="secondary"
                  disabled={currentStep === 'account' || isSubmitting}
                  onClick={handlePrevious}
                >
                  ← Précédent
                </Button>

                {currentStep === 'notes' ? (
                  <Button onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <span className="mr-2 animate-spin">⏳</span>
                        Création en cours...
                      </>
                    ) : (
                      'Créer le dossier'
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    disabled={currentStep === 'account' && !shouldEnableNextButton(isAccountStepComplete())}
                  >
                    Suivant →
                  </Button>
                )}
              </div>
            )}

            {/* New dossier button (after success) */}
            {submitResult?.success && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Reset form for new dossier
                    setCurrentStep('account');
                    setAccountData(DEFAULT_ACCOUNT_DATA);
                    setStep1Data(DEFAULT_STEP1_DATA);
                    setStep2Data(DEFAULT_STEP2_DATA);
                    setDocumentData(DEFAULT_DOCUMENT_UPLOAD_DATA);
                    setNotesData(DEFAULT_NOTES_DATA);
                    setAccountSearchState(null);
                    setSubmitResult(null);
                    setUploadResult(null);
                    setNoteResult(null);
                  }}
                >
                  Créer un nouveau dossier
                </Button>
              </div>
            )}

            {/* Debug: Current form data (DEV only) */}
            {isDevMode && (
              <details className="mt-8">
                <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
                  Debug: Form Data
                </summary>
                <pre className="p-4 mt-2 overflow-auto text-xs rounded bg-muted text-muted-foreground">
                  {JSON.stringify({ currentStep, accountData, accountSearchState, step1Data, step2Data, documentData, notesData, submitResult, uploadResult, noteResult }, null, 2)}
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
