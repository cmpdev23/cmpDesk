/**
 * @file src/lib/opportunity/picklists.ts
 * @description Picklist mappings for Opportunity fields
 * 
 * These mappings connect Salesforce API values to French labels for UI display.
 * Source: docs/opportunity.md (extracted via API inspection)
 * 
 * @see docs/opportunity.md - Full field documentation
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PicklistOption {
  value: string;  // API value (sent to Salesforce)
  label: string;  // French label (displayed in UI)
}

// ─── Product Interest (Produit d'intérêt) ─────────────────────────────────────

export const PRODUCT_INTEREST_OPTIONS: PicklistOption[] = [
  { value: 'Group Insurance', label: 'Assurance Collective' },
  { value: 'Children and Dependants Insurance', label: 'Assurance Enfants/Personnes à Charge' },
  { value: 'Disability Insurance', label: 'Assurance Invalidité' },
  { value: 'Critical Illness Insurance', label: 'Assurance Maladie Grave' },
  { value: 'Loan Insurance', label: 'Assurance Prêt' },
  { value: 'Life Insurance', label: 'Assurance Vie' },
  { value: 'Travel Insurance', label: 'Assurance Voyage' },
  { value: 'FHSA', label: 'CELIAPP' },
  { value: 'TFSA', label: 'CELI' },
  { value: 'LIRA', label: 'CRI' },
  { value: 'RRIF', label: 'FERR' },
  { value: 'LIF', label: 'FRV' },
  { value: 'RESP', label: 'REEE' },
  { value: 'RRSP', label: 'REER' },
  { value: 'Non-registered Savings', label: 'Épargne Non-enregistrée' },
  { value: 'Mortgage Loan Referral', label: 'Référence Prêt Hypothécaire' },
  { value: 'Home and Auto Insurance Referral', label: 'Référence IAAH' },
  { value: 'Referral', label: 'Référence' },
];

// ─── Opportunity Category (Catégorie de l'opportunité) ────────────────────────

export const OPPORTUNITY_CATEGORY_OPTIONS: PicklistOption[] = [
  { value: 'Gobal Offer', label: 'Offre Globale' }, // Note: typo in Salesforce ("Gobal" instead of "Global")
  { value: 'Update/Investor Profile', label: 'Mise à jour/Profil investisseur' },
  { value: 'Market Analysis', label: 'Analyse de marché' },
  { value: 'Birth', label: 'Naissance' },
  { value: 'Buying a house', label: 'Achat de maison' },
  { value: 'Mortgage loan', label: 'Prêt hypothécaire' },
  { value: 'Retirement', label: 'Retraite' },
  { value: 'Insurance', label: 'Assurance' },
  { value: 'Savings', label: 'Épargne' },
  { value: 'IAAH', label: 'IAAH' },
  { value: 'Large case solutions', label: 'Solutions cas avancées' },
  { value: 'Business Solutions', label: 'Solutions Entreprise' },
];

// ─── Subsidiary (Filiale) ─────────────────────────────────────────────────────

export const SUBSIDIARY_OPTIONS: PicklistOption[] = [
  { value: 'iA', label: 'iA' },
  { value: 'Excellence', label: 'Excellence' },
  { value: 'PPI', label: 'PPI' },
  { value: 'Investia', label: 'Investia' },
  { value: 'MRA', label: 'MRA' },
  { value: 'Other', label: 'Autre' },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Get the French label for an API value from a picklist
 */
export function getLabelForValue(options: PicklistOption[], value: string): string | undefined {
  return options.find(opt => opt.value === value)?.label;
}

/**
 * Get the API value for a French label from a picklist
 */
export function getValueForLabel(options: PicklistOption[], label: string): string | undefined {
  return options.find(opt => opt.label === label)?.value;
}
