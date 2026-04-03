/**
 * @file src/modules/dossiers/components/OpportunityFormStep1.tsx
 * @description Step 1 of the Opportunity creation form — Informations générales
 *
 * Fields included (from docs/opportunity.md):
 * - Opportunity_Category__c (Catégorie de l'opportunité)
 * - Product_Interest__c (Produit d'intérêt)
 * - Subsidiary__c (Filiale)
 * - Proposal_Number__c (Numéro de proposition)
 * - Contract_Number__c (Numéro de contrat)
 * - Transaction_Date__c (Date de transaction)
 * - Annual_Premium__c (Prime annuelle)
 * + Phone (Téléphone) — workflow field
 * + Email (Courriel) — workflow field
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
} from "../lib/picklists";
import type { OpportunityStep1Data } from "../types";

interface OpportunityFormStep1Props {
  data: OpportunityStep1Data;
  onChange: (data: OpportunityStep1Data) => void;
  errors?: Record<string, string>;
}

/**
 * Step 1 form component for Opportunity creation.
 * Handles "Informations générales" section.
 *
 * Two handlers:
 * - handleInputChange  → DOM ChangeEvent (InputField)
 * - handleSelectChange → string value (SelectField / shadcn Radix)
 */
export function OpportunityFormStep1({
  data,
  onChange,
  errors = {},
}: OpportunityFormStep1Props) {
  // Handler for shadcn Input (DOM ChangeEvent)
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  // Handler for shadcn Select (Radix onValueChange — pure string)
  const handleSelectChange =
    (field: keyof OpportunityStep1Data) => (value: string) => {
      onChange({ ...data, [field]: value });
    };

  return (
    <Card className="pl-1 border border-border ring-0">
      <CardHeader>
        <CardTitle>Étape 1 — Informations générales</CardTitle>
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

          {/* ─── Numéro de proposition ─────────────────────────────────── */}
          <FormField
            label="Numéro de proposition"
            htmlFor="proposalNumber"
            error={errors.proposalNumber}
          >
            <InputField
              id="proposalNumber"
              name="proposalNumber"
              value={data.proposalNumber}
              onChange={handleInputChange}
              placeholder="Ex: PROP-2026-001"
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

          {/* ─── Date de transaction ───────────────────────────────────── */}
          <FormField
            label="Date de transaction"
            htmlFor="transactionDate"
            error={errors.transactionDate}
          >
            <InputField
              id="transactionDate"
              name="transactionDate"
              type="date"
              value={data.transactionDate}
              onChange={handleInputChange}
            />
          </FormField>

          {/* ─── Prime annuelle ────────────────────────────────────────── */}
          <FormField
            label="Prime annuelle"
            htmlFor="annualPremium"
            error={errors.annualPremium}
          >
            <div className="relative">
              <InputField
                id="annualPremium"
                name="annualPremium"
                type="number"
                value={data.annualPremium}
                onChange={handleInputChange}
                placeholder="0.00"
                min={0}
                step="0.01"
              />
              <span className="absolute text-sm -translate-y-1/2 pointer-events-none right-10 top-1/2 text-muted-foreground">
                $
              </span>
            </div>
          </FormField>

          {/* ─── Séparateur Contact ────────────────────────────────────── */}
          <div className="col-span-1 pt-2 md:col-span-2">
            <p className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
              Coordonnées du client
            </p>
          </div>

          {/* ─── Téléphone ─────────────────────────────────────────────── */}
          <FormField label="Téléphone" htmlFor="phone" error={errors.phone}>
            <InputField
              id="phone"
              name="phone"
              type="tel"
              value={data.phone}
              onChange={handleInputChange}
              placeholder="Ex: 514-555-1234"
            />
          </FormField>

          {/* ─── Courriel ──────────────────────────────────────────────── */}
          <FormField label="Courriel" htmlFor="email" error={errors.email}>
            <InputField
              id="email"
              name="email"
              type="email"
              value={data.email}
              onChange={handleInputChange}
              placeholder="Ex: client@exemple.com"
            />
          </FormField>
        </div>
      </CardContent>
    </Card>
  );
}
