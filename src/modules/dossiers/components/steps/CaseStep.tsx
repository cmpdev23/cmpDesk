/**
 * @file src/modules/dossiers/components/steps/CaseStep.tsx
 * @description Step 3 — Case/Product family information (Informations du dossier)
 *
 * Fields included (from docs/Case.md):
 * - Product_Family__c (Famille de produit)
 * - Transaction_Category__c (Catégorie de transaction) — controlled by Product_Family__c
 * - Transaction_Sub_Category__c (Sous-catégorie de transaction) — controlled by Transaction_Category__c
 * - SignatureType__c (Type de signature) — controlled by Transaction_Sub_Category__c
 * - ProductType__c (Type de Produit) — controlled by SignatureType__c
 * - CustomersPlaceOfResidence__c (Lieu de résidence du client) — independent
 *
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { useMemo } from "react";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
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
} from "../../lib/picklists";
import type { CaseStep2Data } from "../../types";

interface CaseStepProps {
  data: CaseStep2Data;
  onChange: (data: CaseStep2Data) => void;
  errors?: Record<string, string>;
}

/**
 * Step 3 form component for Opportunity creation.
 * Handles "Informations du dossier (Case)" section.
 *
 * Features cascading picklists based on Salesforce field dependencies:
 * Product Family → Transaction Category → Sub-Category → Signature Type → Product Type
 */
export function CaseStep({
  data,
  onChange,
  errors = {},
}: CaseStepProps) {
  // ─── Filtered Options (Cascading Dependencies) ────────────────────────────────

  /**
   * Filter Transaction Category options based on selected Product Family
   */
  const filteredTransactionCategoryOptions = useMemo(() => {
    if (!data.productFamily) return [];
    const validValues = TRANSACTION_CATEGORY_BY_FAMILY[data.productFamily] || [];
    return TRANSACTION_CATEGORY_OPTIONS.filter((opt) =>
      validValues.includes(opt.value)
    );
  }, [data.productFamily]);

  /**
   * Filter Transaction Sub-Category options based on selected Transaction Category
   */
  const filteredSubCategoryOptions = useMemo(() => {
    if (!data.transactionCategory) return [];
    const validValues =
      TRANSACTION_SUB_CATEGORY_BY_CATEGORY[data.transactionCategory] || [];
    return TRANSACTION_SUB_CATEGORY_OPTIONS.filter((opt) =>
      validValues.includes(opt.value)
    );
  }, [data.transactionCategory]);

  /**
   * Filter Signature Type options based on selected Sub-Category
   */
  const filteredSignatureTypeOptions = useMemo(() => {
    if (!data.transactionSubCategory) return [];
    const validValues =
      SIGNATURE_TYPE_BY_SUB_CATEGORY[data.transactionSubCategory] || [];
    // If no specific mapping exists, return all options
    if (validValues.length === 0) return SIGNATURE_TYPE_OPTIONS;
    return SIGNATURE_TYPE_OPTIONS.filter((opt) =>
      validValues.includes(opt.value)
    );
  }, [data.transactionSubCategory]);

  /**
   * Filter Product Type options based on selected Signature Type
   */
  const filteredProductTypeOptions = useMemo(() => {
    if (!data.signatureType) return [];
    const validValues = PRODUCT_TYPE_BY_SIGNATURE[data.signatureType] || [];
    // If no specific mapping exists, return all options
    if (validValues.length === 0) return PRODUCT_TYPE_OPTIONS;
    return PRODUCT_TYPE_OPTIONS.filter((opt) =>
      validValues.includes(opt.value)
    );
  }, [data.signatureType]);

  // ─── Change Handlers ──────────────────────────────────────────────────────────

  /**
   * Generic handler for SelectField (Radix onValueChange — pure string)
   * Includes cascade reset logic for dependent fields
   */
  const handleSelectChange =
    (field: keyof CaseStep2Data) => (value: string) => {
      const updates: Partial<CaseStep2Data> = { [field]: value };

      // Cascade reset: when parent changes, reset all dependent children
      switch (field) {
        case "productFamily":
          updates.transactionCategory = "";
          updates.transactionSubCategory = "";
          updates.signatureType = "";
          updates.productType = "";
          break;
        case "transactionCategory":
          updates.transactionSubCategory = "";
          updates.signatureType = "";
          updates.productType = "";
          break;
        case "transactionSubCategory":
          updates.signatureType = "";
          updates.productType = "";
          break;
        case "signatureType":
          updates.productType = "";
          break;
      }

      onChange({ ...data, ...updates });
    };

  return (
    <Card className="pl-1 border border-border ring-0">
      <CardHeader>
        <CardTitle>Étape 3 — Informations du dossier</CardTitle>
        <CardDescription>
          Définissez les paramètres de la transaction
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Form grid — 2 columns on larger screens */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* ─── Famille de produit ─────────────────────────────────────────── */}
          <FormField
            label="Famille de produit"
            htmlFor="productFamily"
            required
            error={errors.productFamily}
          >
            <SelectField
              id="productFamily"
              name="productFamily"
              value={data.productFamily}
              onValueChange={handleSelectChange("productFamily")}
              options={PRODUCT_FAMILY_OPTIONS}
              placeholder="Sélectionner une famille..."
              required
            />
          </FormField>

          {/* ─── Catégorie de transaction ───────────────────────────────────── */}
          <FormField
            label="Catégorie de transaction"
            htmlFor="transactionCategory"
            required
            error={errors.transactionCategory}
          >
            <SelectField
              id="transactionCategory"
              name="transactionCategory"
              value={data.transactionCategory}
              onValueChange={handleSelectChange("transactionCategory")}
              options={filteredTransactionCategoryOptions}
              placeholder="Sélectionner une catégorie..."
              disabled={!data.productFamily}
              required
            />
          </FormField>

          {/* ─── Sous-catégorie de transaction ──────────────────────────────── */}
          <FormField
            label="Sous-catégorie de transaction"
            htmlFor="transactionSubCategory"
            error={errors.transactionSubCategory}
          >
            <SelectField
              id="transactionSubCategory"
              name="transactionSubCategory"
              value={data.transactionSubCategory}
              onValueChange={handleSelectChange("transactionSubCategory")}
              options={filteredSubCategoryOptions}
              placeholder="Sélectionner une sous-catégorie..."
              disabled={!data.transactionCategory}
            />
          </FormField>

          {/* ─── Type de signature ──────────────────────────────────────────── */}
          <FormField
            label="Type de signature"
            htmlFor="signatureType"
            error={errors.signatureType}
          >
            <SelectField
              id="signatureType"
              name="signatureType"
              value={data.signatureType}
              onValueChange={handleSelectChange("signatureType")}
              options={filteredSignatureTypeOptions}
              placeholder="Sélectionner un type..."
              disabled={!data.transactionSubCategory}
            />
          </FormField>

          {/* ─── Type de Produit ────────────────────────────────────────────── */}
          <FormField
            label="Type de produit"
            htmlFor="productType"
            error={errors.productType}
          >
            <SelectField
              id="productType"
              name="productType"
              value={data.productType}
              onValueChange={handleSelectChange("productType")}
              options={filteredProductTypeOptions}
              placeholder="Sélectionner un type..."
              disabled={!data.signatureType}
            />
          </FormField>

          {/* ─── Lieu de résidence du client ────────────────────────────────── */}
          <FormField
            label="Lieu de résidence du client"
            htmlFor="customersPlaceOfResidence"
            error={errors.customersPlaceOfResidence}
          >
            <SelectField
              id="customersPlaceOfResidence"
              name="customersPlaceOfResidence"
              value={data.customersPlaceOfResidence}
              onValueChange={handleSelectChange("customersPlaceOfResidence")}
              options={CUSTOMERS_PLACE_OF_RESIDENCE_OPTIONS}
              placeholder="Sélectionner un lieu..."
            />
          </FormField>
        </div>
      </CardContent>
    </Card>
  );
}
