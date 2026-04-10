/**
 * @file src/modules/dossiers/components/steps/OpportunityStep.tsx
 * @description Step 2 — Opportunity general information (Informations générales)
 *
 * Fields included (from docs/opportunity.md):
 * - Opportunity_Category__c (Catégorie de l'opportunité)
 * - Product_Interest__c (Produit d'intérêt)
 * - Subsidiary__c (Filiale)
 * - Proposal_Number__c (Numéro de proposition)
 * - Contract_Number__c (Numéro de contrat)
 * - Transaction_Date__c (Date de transaction)
 * - Annual_Premium__c (Prime annuelle)
 *
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { ChangeEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { InputField } from "@/components/ui/input-field";
import { SelectField } from "@/components/ui/select-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  OPPORTUNITY_CATEGORY_OPTIONS,
  PRODUCT_INTEREST_OPTIONS,
  SUBSIDIARY_OPTIONS,
} from "../../lib/picklists";
import type { OpportunityStep1Data } from "../../types";

interface OpportunityStepProps {
  data: OpportunityStep1Data;
  onChange: (data: OpportunityStep1Data) => void;
  errors?: Record<string, string>;
}

/**
 * Step 2 form component for Opportunity creation.
 * Handles "Informations générales" section.
 *
 * Two handlers:
 * - handleInputChange  → DOM ChangeEvent (InputField)
 * - handleSelectChange → string value (SelectField / shadcn Radix)
 */
export function OpportunityStep({
  data,
  onChange,
  errors = {},
}: OpportunityStepProps) {
  // Handler for shadcn Input (DOM ChangeEvent)
  // Special mirror: contractNumber → proposalNumber (one-way sync)
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const updates: Partial<typeof data> = { [name]: value };
    // Mirror contract → proposal (proposalNumber is hidden, mirrors contractNumber)
    if (name === 'contractNumber') {
      updates.proposalNumber = value;
    }
    onChange({ ...data, ...updates });
  };

  // Handler for shadcn Select (Radix onValueChange — pure string)
  const handleSelectChange =
    (field: keyof OpportunityStep1Data) => (value: string) => {
      onChange({ ...data, [field]: value });
    };

  return (
    <Card className="pl-1 border border-border ring-0">
      <CardHeader>
        <CardTitle>Étape 2 — Informations générales</CardTitle>
        <CardDescription>
          Remplissez les informations de base de l'opportunité
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Form grid — 2 columns on larger screens */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* ─── Catégorie de l'opportunité ─────────────────────────────── */}
          <FormField
            label="Catégorie de l'opportunité"
            htmlFor="opportunityCategory"
            required
            error={errors.opportunityCategory}
          >
            <SelectField
              id="opportunityCategory"
              name="opportunityCategory"
              value={data.opportunityCategory}
              onValueChange={handleSelectChange("opportunityCategory")}
              options={OPPORTUNITY_CATEGORY_OPTIONS}
              placeholder="Sélectionner une catégorie..."
              required
            />
          </FormField>

          {/* ─── Produit d'intérêt ──────────────────────────────────────── */}
          <FormField
            label="Produit d'intérêt"
            htmlFor="productInterest"
            error={errors.productInterest}
          >
            <SelectField
              id="productInterest"
              name="productInterest"
              value={data.productInterest}
              onValueChange={handleSelectChange("productInterest")}
              options={PRODUCT_INTEREST_OPTIONS}
              placeholder="Sélectionner un produit..."
            />
          </FormField>

          {/* ─── Filiale ───────────────────────────────────────────────── */}
          <FormField
            label="Filiale"
            htmlFor="subsidiary"
            required
            error={errors.subsidiary}
          >
            <SelectField
              id="subsidiary"
              name="subsidiary"
              value={data.subsidiary}
              onValueChange={handleSelectChange("subsidiary")}
              options={SUBSIDIARY_OPTIONS}
              placeholder="Sélectionner une filiale..."
              required
            />
          </FormField>

          {/* ─── Numéro de contrat ─────────────────────────────────────── */}
          <FormField
            label="Numéro de contrat"
            htmlFor="contractNumber"
            error={errors.contractNumber}
          >
            <InputField
              id="contractNumber"
              name="contractNumber"
              value={data.contractNumber}
              onChange={handleInputChange}
              placeholder="Ex: CNT-2026-001"
            />
          </FormField>

          {/* ─── Hidden fields ─────────────────────────────────────────── */}
          {/* transactionDate — always today's date */}
          <input
            type="hidden"
            name="transactionDate"
            value={data.transactionDate}
          />
          {/* annualPremium — fixed default value: 23 */}
          {/* proposalNumber — mirrors contractNumber */}
          <input
            type="hidden"
            name="proposalNumber"
            value={data.contractNumber}
          />
        </div>
      </CardContent>
    </Card>
  );
}
