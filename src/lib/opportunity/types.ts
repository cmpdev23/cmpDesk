/**
 * @file src/lib/opportunity/types.ts
 * @description Types for Opportunity form data
 * 
 * @see docs/opportunity.md - Full field documentation
 */

// ─── Form Data Types ──────────────────────────────────────────────────────────

/**
 * Step 1 form data - Informations générales
 */
export interface OpportunityStep1Data {
  // Picklist fields
  opportunityCategory: string;     // Opportunity_Category__c
  productInterest: string;         // Product_Interest__c
  subsidiary: string;              // Subsidiary__c
  
  // Text fields
  proposalNumber: string;          // Proposal_Number__c
  contractNumber: string;          // Contract_Number__c
  
  // Date field
  transactionDate: string;         // Transaction_Date__c (ISO format YYYY-MM-DD)
  
  // Currency field
  annualPremium: string;           // Annual_Premium__c (string for input, converted to number)
  
  // Contact fields (not in Salesforce opportunity, but needed for workflow)
  phone: string;                   // Client phone
  email: string;                   // Client email
}

/**
 * Full Opportunity form data (all steps combined)
 * Will be extended as we add more steps
 */
export interface OpportunityFormData extends OpportunityStep1Data {
  // Step 2 fields will be added here
  // Step 3 fields will be added here
}

// ─── Default Values ───────────────────────────────────────────────────────────

export const DEFAULT_STEP1_DATA: OpportunityStep1Data = {
  opportunityCategory: '',
  productInterest: '',
  subsidiary: '',
  proposalNumber: '',
  contractNumber: '',
  transactionDate: '',
  annualPremium: '',
  phone: '',
  email: '',
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
