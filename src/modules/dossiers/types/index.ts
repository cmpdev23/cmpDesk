/**
 * @file src/modules/dossiers/types/index.ts
 * @description TypeScript types for the Dossiers module (Opportunity form)
 *
 * @see docs/opportunity.md - Full field documentation
 */

// ─── Form Data Types ──────────────────────────────────────────────────────────

/**
 * Step 1 form data - Infos Compte (client contact information)
 */
export interface AccountStepData {
  firstName: string; // Prénom
  lastName: string; // Nom
  phone: string; // Téléphone
  email: string; // Email
}

/**
 * Account search result state - stored after searching for existing account
 */
export interface AccountSearchState {
  /** Whether an account was found */
  found: boolean;
  /** Salesforce Account ID (001...) if found */
  accountId?: string;
  /** Account name if found */
  accountName?: string;
  /** How the account was matched */
  matchedBy?: 'phone' | 'email' | 'name';
  /** True if this is a newly created account (not an existing one) */
  isNewAccount?: boolean;
}

/**
 * Step 2 form data - Informations générales
 */
export interface OpportunityStep1Data {
  // Picklist fields
  opportunityCategory: string; // Opportunity_Category__c
  productInterest: string; // Product_Interest__c
  subsidiary: string; // Subsidiary__c

  // Text fields
  proposalNumber: string; // Proposal_Number__c
  contractNumber: string; // Contract_Number__c

  // Date field
  transactionDate: string; // Transaction_Date__c (ISO format YYYY-MM-DD)

  // Currency field
  annualPremium: string; // Annual_Premium__c (string for input, converted to number on submit)
}

/**
 * Step 2 form data - Informations du dossier (Case)
 * Maps to Salesforce Case object fields
 *
 * @see docs/Case.md - Full field documentation
 */
export interface CaseStep2Data {
  // Picklist fields with dependencies (cascade)
  productFamily: string; // Product_Family__c
  transactionCategory: string; // Transaction_Category__c (controlled by productFamily)
  transactionSubCategory: string; // Transaction_Sub_Category__c (controlled by transactionCategory)
  signatureType: string; // SignatureType__c (controlled by transactionSubCategory)
  productType: string; // ProductType__c (controlled by signatureType)

  // Independent picklist
  customersPlaceOfResidence: string; // CustomersPlaceOfResidence__c
}

/**
 * Full Opportunity form data (all steps combined).
 * Extended as we add more steps.
 */
export interface OpportunityFormData extends AccountStepData, OpportunityStep1Data, CaseStep2Data {
  // Future steps can be added here
}

// ─── Default Values ───────────────────────────────────────────────────────────

export const DEFAULT_ACCOUNT_DATA: AccountStepData = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
};

export const DEFAULT_STEP1_DATA: OpportunityStep1Data = {
  opportunityCategory: '',
  productInterest: '',
  subsidiary: '',
  proposalNumber: '',
  contractNumber: '',
  transactionDate: '',
  annualPremium: '',
};

export const DEFAULT_STEP2_DATA: CaseStep2Data = {
  productFamily: '',
  transactionCategory: '',
  transactionSubCategory: '',
  signatureType: '',
  productType: '',
  customersPlaceOfResidence: '',
};

// ─── Validation Types ─────────────────────────────────────────────────────────

export interface ValidationError {
  field: keyof OpportunityStep1Data;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}
