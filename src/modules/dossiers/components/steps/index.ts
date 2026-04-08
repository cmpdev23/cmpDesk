/**
 * @file src/modules/dossiers/components/steps/index.ts
 * @description Barrel export for all form steps in the Dossiers module
 *
 * Naming convention: {Domain}Step.tsx — Name describes WHAT the step handles, NOT its position.
 *
 * Step order in workflow:
 * 1. AccountInfoStep    — Account contact information
 * 1.5 AccountSearchStep — Search result (intermediate)
 * 2. OpportunityStep    — Opportunity general information
 * 3. CaseStep           — Case/Product family information
 * 4. DocumentsStep      — Document upload
 * 5. NotesStep          — Notes (free-text)
 */

// Step 1 — Account Info
export { AccountInfoStep } from './AccountInfoStep';

// Step 1.5 — Account Search Result (intermediate)
export { AccountSearchStep } from './AccountSearchStep';
export type { SearchStepStatus } from './AccountSearchStep';

// Step 2 — Opportunity
export { OpportunityStep } from './OpportunityStep';

// Step 3 — Case
export { CaseStep } from './CaseStep';

// Step 4 — Documents
export { DocumentsStep, DEFAULT_DOCUMENTS_DATA } from './DocumentsStep';
export type { DocumentsStepData, UploadedFile } from './DocumentsStep';

// Step 5 — Notes
export { NotesStep, DEFAULT_NOTES_DATA } from './NotesStep';
export type { NotesStepData } from './NotesStep';
