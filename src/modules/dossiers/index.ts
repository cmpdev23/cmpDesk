/**
 * @file src/modules/dossiers/index.ts
 * @description Public API for the Dossiers module
 *
 * All imports from outside this module should go through this barrel export.
 * Internal files import directly from their relative paths.
 *
 * Usage:
 *   import { OpportunityFormStep1, OpportunityFormStep2, DEFAULT_STEP1_DATA } from '@/modules/dossiers';
 */

// Components
export { OpportunityFormStepCompte } from './components/OpportunityFormStepCompte';
export { AccountSearchStep } from './components/AccountSearchStep';
export type { SearchStepStatus } from './components/AccountSearchStep';
export { OpportunityFormStep1 } from './components/OpportunityFormStep1';
export { OpportunityFormStep2 } from './components/OpportunityFormStep2';
export { DocumentUploadStep, DEFAULT_DOCUMENT_UPLOAD_DATA } from './components/DocumentUploadStep';
export type { DocumentUploadStepData, UploadedFile } from './components/DocumentUploadStep';
export { NotesStep, DEFAULT_NOTES_DATA } from './components/NotesStep';
export type { NotesStepData } from './components/NotesStep';
export { DossierPageHeader } from './components/DossierPageHeader';

// Types
export type {
  AccountStepData,
  AccountSearchState,
  OpportunityStep1Data,
  CaseStep2Data,
  OpportunityFormData,
  ValidationError,
  ValidationResult,
} from './types';
export { DEFAULT_ACCOUNT_DATA, DEFAULT_STEP1_DATA, DEFAULT_STEP2_DATA } from './types';

// Picklists — Opportunity (Step 1)
export {
  OPPORTUNITY_CATEGORY_OPTIONS,
  PRODUCT_INTEREST_OPTIONS,
  SUBSIDIARY_OPTIONS,
  getLabelForValue,
  getValueForLabel,
} from './lib/picklists';

// Picklists — Case (Step 2)
export {
  PRODUCT_FAMILY_OPTIONS,
  TRANSACTION_CATEGORY_OPTIONS,
  TRANSACTION_CATEGORY_BY_FAMILY,
  TRANSACTION_SUB_CATEGORY_OPTIONS,
  TRANSACTION_SUB_CATEGORY_BY_CATEGORY,
  SIGNATURE_TYPE_OPTIONS,
  SIGNATURE_TYPE_BY_SUB_CATEGORY,
  PRODUCT_TYPE_OPTIONS,
  PRODUCT_TYPE_BY_SIGNATURE,
  CUSTOMERS_PLACE_OF_RESIDENCE_OPTIONS,
} from './lib/picklists';
