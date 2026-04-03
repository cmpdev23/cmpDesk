/**
 * @file src/modules/dossiers/index.ts
 * @description Public API for the Dossiers module
 *
 * All imports from outside this module should go through this barrel export.
 * Internal files import directly from their relative paths.
 *
 * Usage:
 *   import { OpportunityFormStep1, DEFAULT_STEP1_DATA } from '@/modules/dossiers';
 */

// Components
export { OpportunityFormStep1 } from './components/OpportunityFormStep1';
export { DossierPageHeader } from './components/DossierPageHeader';

// Types
export type {
  OpportunityStep1Data,
  OpportunityFormData,
  ValidationError,
  ValidationResult,
} from './types';
export { DEFAULT_STEP1_DATA } from './types';

// Picklists (exported for potential use in other modules — e.g., search filters)
export {
  OPPORTUNITY_CATEGORY_OPTIONS,
  PRODUCT_INTEREST_OPTIONS,
  SUBSIDIARY_OPTIONS,
  getLabelForValue,
  getValueForLabel,
} from './lib/picklists';
