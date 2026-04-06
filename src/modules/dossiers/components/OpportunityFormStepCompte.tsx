/**
 * @file src/modules/dossiers/components/OpportunityFormStepCompte.tsx
 * @description Step 1 of the Opportunity creation form — Infos Compte
 *
 * Features:
 * - Client contact information (firstName, lastName, phone, email)
 * - Search is triggered by parent component when clicking "Next"
 *
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { ChangeEvent } from "react";
import { FormField } from "@/components/ui/form-field";
import { InputField } from "@/components/ui/input-field";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AccountStepData } from "../types";

interface OpportunityFormStepCompteProps {
  data: AccountStepData;
  onChange: (data: AccountStepData) => void;
  errors?: Record<string, string>;
}

/**
 * Step 1 form component for Opportunity creation.
 * Handles "Infos Compte" section — client contact information.
 * Search is triggered by the parent component when user clicks "Next".
 */
export function OpportunityFormStepCompte({
  data,
  onChange,
  errors = {},
}: OpportunityFormStepCompteProps) {
  // Handler for shadcn Input (DOM ChangeEvent)
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
  };

  return (
    <Card className="pl-1 border border-border ring-0">
      <CardHeader>
        <CardTitle>Étape 1 — Infos Compte</CardTitle>
        <CardDescription>
          Remplissez les informations de contact du client
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Form grid — 2 columns on larger screens */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* ─── Prénom ───────────────────────────────────────────────────── */}
          <FormField
            label="Prénom"
            htmlFor="firstName"
            required
            error={errors.firstName}
          >
            <InputField
              id="firstName"
              name="firstName"
              value={data.firstName}
              onChange={handleInputChange}
              placeholder="Ex: Jean"
              required
            />
          </FormField>

          {/* ─── Nom ──────────────────────────────────────────────────────── */}
          <FormField
            label="Nom"
            htmlFor="lastName"
            required
            error={errors.lastName}
          >
            <InputField
              id="lastName"
              name="lastName"
              value={data.lastName}
              onChange={handleInputChange}
              placeholder="Ex: Dupont"
              required
            />
          </FormField>

          {/* ─── Téléphone ────────────────────────────────────────────────── */}
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
              onChange={handleInputChange}
              placeholder="Ex: 514-555-1234"
            />
          </FormField>

          {/* ─── Email ────────────────────────────────────────────────────── */}
          <FormField
            label="Email"
            htmlFor="email"
            error={errors.email}
          >
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

        {/* Helper text */}
        <p className="text-xs text-muted-foreground">
          Cliquez sur "Suivant" pour rechercher si le client existe déjà dans Salesforce.
        </p>
      </CardContent>
    </Card>
  );
}
