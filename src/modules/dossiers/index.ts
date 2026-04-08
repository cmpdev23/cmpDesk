/**
 * @file src/modules/dossiers/index.ts
 * @description Public API for the Dossiers module
 *
 * All imports from outside this module should go through this barrel export.
 * Internal files import directly from their relative paths.
 *
 * Usage:
 *   import { OpportunityStep, CaseStep, DEFAULT_STEP1_DATA } from '@/modules/dossiers';
 */

// ─── Step Components ────────────────────────────────────────────────────────────
// All form steps are in components/steps/ folder
// Naming: {Domain}Step.tsx — describes WHAT the step handles, NOT its position

export {
  // Step 1 — Account Info
  AccountInfoStep,
  // Step 1.5 — Account Search Result (intermediate)
  AccountSearchStep,
  // Step 2 — Opportunity
  OpportunityStep,
  // Step 3 — Case
  CaseStep,
  // Step 4 — Documents
  DocumentsStep,
  DEFAULT_DOCUMENTS_DATA,
  // Step 5 — Notes
  NotesStep,
  DEFAULT_NOTES_DATA,
} from './components/steps';

export type {
  SearchStepStatus,
  DocumentsStepData,
  UploadedFile,
  NotesStepData,
} from './components/steps';

// ─── Other Components ───────────────────────────────────────────────────────────
export { DossierPageHeader } from './components/DossierPageHeader';

// ─── Types ──────────────────────────────────────────────────────────────────────
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

// ─── Picklists — Opportunity (Step 2) ───────────────────────────────────────────
export {
  OPPORTUNITY_CATEGORY_OPTIONS,
  PRODUCT_INTEREST_OPTIONS,
  SUBSIDIARY_OPTIONS,
  getLabelForValue,
  getValueForLabel,
} from './lib/picklists';

// ─── Picklists — Case (Step 3) ──────────────────────────────────────────────────
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
