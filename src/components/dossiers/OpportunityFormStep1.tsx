/**
 * @file src/components/dossiers/OpportunityFormStep1.tsx
 * @description Step 1 of the Opportunity creation form - Informations générales
 * 
 * Fields included (from docs/opportunity.md):
 * - Opportunity_Category__c (Catégorie de l'opportunité)
 * - Product_Interest__c (Produit d'intérêt)
 * - Subsidiary__c (Filiale)
 * - Proposal_Number__c (Numéro de proposition)
 * - Contract_Number__c (Numéro de contrat)
 * - Transaction_Date__c (Date de transaction)
 * - Annual_Premium__c (Prime annuelle)
 * + Phone (Téléphone) - workflow field
 * + Email (Courriel) - workflow field
 * 
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { ChangeEvent } from 'react';
import { FormField, SelectField, InputField } from '../forms';
import {
  OPPORTUNITY_CATEGORY_OPTIONS,
  PRODUCT_INTEREST_OPTIONS,
  SUBSIDIARY_OPTIONS,
} from '../../lib/opportunity/picklists';
import type { OpportunityStep1Data } from '../../lib/opportunity/types';

interface OpportunityFormStep1Props {
  data: OpportunityStep1Data;
  onChange: (data: OpportunityStep1Data) => void;
  errors?: Record<string, string>;
}

/**
 * Step 1 form component for Opportunity creation
 * Handles "Informations générales" section
 */
export function OpportunityFormStep1({
  data,
  onChange,
  errors = {},
}: OpportunityFormStep1Props) {
  
  // Generic handler for all field changes
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    onChange({
      ...data,
      [name]: value,
    });
  };

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="pb-4 border-b border-border">
        <h2 className="text-xl font-semibold text-card-foreground">
          Étape 1 — Informations générales
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Remplissez les informations de base de l'opportunité
        </p>
      </div>

      {/* Form grid - 2 columns on larger screens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
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
            onChange={handleChange}
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
            onChange={handleChange}
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
            onChange={handleChange}
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
            onChange={handleChange}
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
            placeholder="Ex: CNT-2026-001"
            onChange={handleChange}
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
            onChange={handleChange}
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
              onChange={handleChange}
              placeholder="0.00"
              min={0}
              step="0.01"
            />
            <span className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
              $
            </span>
          </div>
        </FormField>

        {/* ─── Séparateur Contact ────────────────────────────────────── */}
        <div className="col-span-1 md:col-span-2 pt-4">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Coordonnées du client
          </h3>
        </div>

        {/* ─── Téléphone ─────────────────────────────────────────────── */}
        <FormField
          label="Téléphone"
          htmlFor="phone"
          error={errors.phone}
        >
          <InputField
            id="phone"
            name="phone"
            type="tel"
            value={data.phone}
            onChange={handleChange}
            placeholder="Ex: 514-555-1234"
          />
        </FormField>

        {/* ─── Courriel ──────────────────────────────────────────────── */}
        <FormField
          label="Courriel"
          htmlFor="email"
          error={errors.email}
        >
          <InputField
            id="email"
            name="email"
            type="email"
            value={data.email}
            onChange={handleChange}
            placeholder="Ex: client@exemple.com"
          />
        </FormField>

      </div>
    </div>
  );
}
