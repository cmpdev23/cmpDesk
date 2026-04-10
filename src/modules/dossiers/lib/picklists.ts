/**
 * @file src/modules/dossiers/lib/picklists.ts
 * @description Picklist mappings for Opportunity and Case fields
 *
 * Connects Salesforce API values to French UI labels.
 * Source: docs/opportunity.md, docs/Case.md (extracted via API inspection)
 *
 * @see docs/opportunity.md - Opportunity field documentation
 * @see docs/Case.md - Case field documentation (Step 2)
 */

import type { PicklistOption } from "@/components/ui/select-field";

// Re-export PicklistOption so module consumers can import from one place
export type { PicklistOption };

// ─── Product Interest (Produit d'intérêt) ─────────────────────────────────────

export const PRODUCT_INTEREST_OPTIONS: PicklistOption[] = [
  { value: "Group Insurance", label: "Assurance Collective" },
  {
    value: "Children and Dependants Insurance",
    label: "Assurance Enfants/Personnes à Charge",
  },
  { value: "Disability Insurance", label: "Assurance Invalidité" },
  { value: "Critical Illness Insurance", label: "Assurance Maladie Grave" },
  { value: "Loan Insurance", label: "Assurance Prêt" },
  { value: "Life Insurance", label: "Assurance Vie" },
  { value: "Travel Insurance", label: "Assurance Voyage" },
  { value: "FHSA", label: "CELIAPP" },
  { value: "TFSA", label: "CELI" },
  { value: "LIRA", label: "CRI" },
  { value: "RRIF", label: "FERR" },
  { value: "LIF", label: "FRV" },
  { value: "RESP", label: "REEE" },
  { value: "RRSP", label: "REER" },
  { value: "Non-registered Savings", label: "Épargne Non-enregistrée" },
  { value: "Mortgage Loan Referral", label: "Référence Prêt Hypothécaire" },
  { value: "Home and Auto Insurance Referral", label: "Référence IAAH" },
  { value: "Referral", label: "Référence" },
];

// ─── Opportunity Category (Catégorie de l'opportunité) ────────────────────────

export const OPPORTUNITY_CATEGORY_OPTIONS: PicklistOption[] = [
  { value: "Gobal Offer", label: "Offre Globale" }, // Note: typo in Salesforce ("Gobal" instead of "Global")
  {
    value: "Update/Investor Profile",
    label: "Mise à jour/Profil investisseur",
  },
  { value: "Market Analysis", label: "Analyse de marché" },
  { value: "Birth", label: "Naissance" },
  { value: "Buying a house", label: "Achat de maison" },
  { value: "Mortgage loan", label: "Prêt hypothécaire" },
  { value: "Retirement", label: "Retraite" },
  { value: "Insurance", label: "Assurance" },
  { value: "Savings", label: "Épargne" },
  { value: "Business Solutions", label: "Solutions Entreprise" },
];

// ─── Subsidiary (Filiale) ─────────────────────────────────────────────────────

export const SUBSIDIARY_OPTIONS: PicklistOption[] = [
  { value: "iA", label: "iA" },
  { value: "Excellence", label: "Excellence" },
  { value: "PPI", label: "PPI" },
  { value: "Investia", label: "Investia" },
  { value: "MRA", label: "MRA" },
  { value: "Other", label: "Autre" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CASE PICKLISTS (Step 2)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Product Family (Famille de produit) ──────────────────────────────────────

export const PRODUCT_FAMILY_OPTIONS: PicklistOption[] = [
  { value: "Insurance", label: "Assurance" },
  { value: "Saving", label: "Épargne" },
];

// ─── Transaction Category (Catégorie de transaction) ──────────────────────────
// Controlled by: Product_Family__c

export const TRANSACTION_CATEGORY_OPTIONS: PicklistOption[] = [
  { value: "Changes_Insurance", label: "Changement (Assurance)" },
  { value: "Changes_Saving", label: "Changement (Épargne)" },
  { value: "Contributions", label: "Contributions" },
  { value: "Correction", label: "Correction" },
  { value: "New application", label: "Nouvelle adhésion" },
  { value: "Loan", label: "Prêt" },
  { value: "Repurchase", label: "Rachat" },
  { value: "Death claim", label: "Règlement décès" },
  { value: "New Contract", label: "Nouveau Contrat" },
  { value: "Other", label: "Autre" },
];

// Dependency map: Product Family → Transaction Categories
export const TRANSACTION_CATEGORY_BY_FAMILY: Record<string, string[]> = {
  Insurance: ["Changes_Insurance", "New Contract", "Other"],
  Saving: [
    "Changes_Saving",
    "Contributions",
    "Correction",
    "New application",
    "Loan",
    "Repurchase",
    "Death claim",
    "Other",
  ],
};

// ─── Transaction Sub-Category (Sous-catégorie de transaction) ─────────────────
// Controlled by: Transaction_Category__c

export const TRANSACTION_SUB_CATEGORY_OPTIONS: PicklistOption[] = [
  {
    value: "Enrolment with transfer in",
    label: "Adhésion avec transfert entrant",
  },
  { value: "RESP Enrolment", label: "Adhésion REEE" },
  {
    value: "Add protection/changing type of protection (13 months)",
    label: "Ajout de protection/changement type de protection (13 mois)",
  },
  { value: "Advisor Change", label: "Changement de représentant" },
  { value: "Conversion", label: "Conversion" },
  { value: "Surrender Correction", label: "Correction rachat" },
  { value: "Subsequent deposit", label: "Dépôt subséquent" },
  { value: "Financial", label: "Financière" },
  { value: "PAD stop or change", label: "Modification ou arrêt de DPA" },
  { value: "Non-financial", label: "Non-financière" },
  { value: "Payment", label: "Paiement" },
  { value: "RESP", label: "REEE" },
  { value: "RRSP", label: "REER" },
  {
    value: "Settlement without benefit SPIA",
    label: "Règlement sans bénéfice - RPU",
  },
  { value: "External Replacement", label: "Remplacement Externe" },
  { value: "Internal Replacement", label: "Remplacement Interne" },
  { value: "RESP Surrender", label: "Retrait REEE" },
  { value: "Regular surrender", label: "Retrait régulier" },
  { value: "Rollover", label: "Roulement" },
  { value: "Without Replacement", label: "Sans remplacement" },
  { value: "Transfer", label: "Transfert" },
  { value: "Incoming transfer", label: "Transfert entrant" },
  { value: "Transfer In RESP", label: "Transfert entrant REEE" },
  { value: "Transfer between contracts", label: "Transfert intercontrats" },
  {
    value: "Inter-fund, inter-series, intracontract transfer",
    label: "Transfert interfonds, interséries, intracontrat",
  },
  { value: "Transformation", label: "Transformation" },
  { value: "Other", label: "Autre" },
  { value: "Other enrolment", label: "Tout autre adhésion" },
];

// Dependency map: Transaction Category → Sub-Categories
export const TRANSACTION_SUB_CATEGORY_BY_CATEGORY: Record<string, string[]> = {
  Changes_Insurance: [
    "Add protection/changing type of protection (13 months)",
    "External Replacement",
    "Internal Replacement",
    "Without Replacement",
    "Transformation",
    "Other",
  ],
  Changes_Saving: [
    "Advisor Change",
    "Conversion",
    "PAD stop or change",
    "Transfer between contracts",
    "Inter-fund, inter-series, intracontract transfer",
    "Other",
  ],
  Contributions: [
    "Subsequent deposit",
    "Incoming transfer",
    "Transfer In RESP",
    "Other",
  ],
  Correction: ["Surrender Correction", "Financial", "Non-financial", "Other"],
  "New application": [
    "Enrolment with transfer in",
    "RESP Enrolment",
    "Other enrolment",
  ],
  Loan: ["RESP", "RRSP", "Other"],
  Repurchase: ["RESP Surrender", "Regular surrender"],
  "Death claim": [
    "Payment",
    "Settlement without benefit SPIA",
    "Rollover",
    "Transfer",
    "Other",
  ],
  "New Contract": [
    "Add protection/changing type of protection (13 months)",
    "External Replacement",
    "Internal Replacement",
    "Without Replacement",
    "Transformation",
  ],
  Other: ["Other"],
};

// ─── Signature Type (Type de signature) ───────────────────────────────────────
// Controlled by: Transaction_Sub_Category__c

export const SIGNATURE_TYPE_OPTIONS: PicklistOption[] = [
  { value: "Electronic", label: "Électronique" },
  { value: "Paper", label: "Papier" },
  { value: "EVO", label: "EVO" },
];

// Dependency map: Sub-Category → Signature Types
export const SIGNATURE_TYPE_BY_SUB_CATEGORY: Record<string, string[]> = {
  "Enrolment with transfer in": ["Electronic", "Paper"],
  "RESP Enrolment": ["Electronic", "Paper"],
  "Add protection/changing type of protection (13 months)": [
    "Electronic",
    "Paper",
  ],
  Conversion: ["Paper"],
  "External Replacement": ["Paper", "EVO"],
  "Internal Replacement": ["Paper", "EVO"],
  "Without Replacement": ["Electronic", "Paper"],
  Transformation: ["Paper"],
  "Other enrolment": ["Electronic", "Paper"],
};

// ─── Product Type (Type de Produit) ───────────────────────────────────────────
// Controlled by: SignatureType__c

export const PRODUCT_TYPE_OPTIONS: PicklistOption[] = [
  { value: "Life Insurance", label: "Assurance Vie" },
  { value: "Critical Illness Insurance", label: "Assurance Maladie Grave" },
];

// Dependency map: Signature Type → Product Types
export const PRODUCT_TYPE_BY_SIGNATURE: Record<string, string[]> = {
  Electronic: [
    "Life Insurance",
    "Critical Illness Insurance",
  ],
  Paper: [
    "Life Insurance",
    "Critical Illness Insurance",
  ],
  // EVO has no product types defined
};

// ─── Customer's Place of Residence (Lieu de résidence du client) ──────────────
// Independent (not controlled by any other field)

export const CUSTOMERS_PLACE_OF_RESIDENCE_OPTIONS: PicklistOption[] = [
  { value: "Quebec", label: "Québec" },
  { value: "Outside Quebec", label: "Hors Québec" },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Get the French label for a given API value from a picklist.
 */
export function getLabelForValue(
  options: PicklistOption[],
  value: string,
): string | undefined {
  return options.find((opt) => opt.value === value)?.label;
}

/**
 * Get the API value for a given French label from a picklist.
 */
export function getValueForLabel(
  options: PicklistOption[],
  label: string,
): string | undefined {
  return options.find((opt) => opt.label === label)?.value;
}
