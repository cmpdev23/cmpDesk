/**
 * @file src/modules/dossiers/components/OpportunityFormStepCompte.tsx
 * @description Step 1 of the Opportunity creation form — Infos Compte
 *
 * Features:
 * - Client contact information (firstName, lastName, phone, email)
 * - Account search by phone/email to detect existing accounts
 * - Shows search results with account found/not found status
 *
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { ChangeEvent, useState } from "react";
import { FormField } from "@/components/ui/form-field";
import { InputField } from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AccountStepData } from "../types";
import type { AccountSearchResult } from "@/types/electron";

// Search status type
type SearchStatus = 'idle' | 'searching' | 'found' | 'not-found' | 'error';

interface OpportunityFormStepCompteProps {
  data: AccountStepData;
  onChange: (data: AccountStepData) => void;
  errors?: Record<string, string>;
  /** Called when an account is found with the account ID */
  onAccountFound?: (accountId: string, accountName: string) => void;
}

/**
 * Step 1 form component for Opportunity creation.
 * Handles "Infos Compte" section — client contact information.
 * Includes account search functionality to detect existing accounts.
 */
export function OpportunityFormStepCompte({
  data,
  onChange,
  errors = {},
  onAccountFound,
}: OpportunityFormStepCompteProps) {
  // Search state
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchResult, setSearchResult] = useState<AccountSearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Handler for shadcn Input (DOM ChangeEvent)
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({ ...data, [name]: value });
    
    // Reset search status when user modifies data
    if (searchStatus !== 'idle') {
      setSearchStatus('idle');
      setSearchResult(null);
      setSearchError(null);
    }
  };

  /**
   * Search for existing account by phone → email → name
   */
  const handleSearch = async () => {
    // Validate we have at least phone or email
    if (!data.phone && !data.email && !data.firstName && !data.lastName) {
      setSearchError('Veuillez remplir au moins le téléphone ou l\'email pour rechercher.');
      return;
    }

    setSearchStatus('searching');
    setSearchError(null);
    setSearchResult(null);

    try {
      const result = await window.electronAPI.salesforce.searchAccount({
        phone: data.phone || undefined,
        email: data.email || undefined,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
      });

      setSearchResult(result);

      if (result.found) {
        setSearchStatus('found');
        // Notify parent component
        if (onAccountFound && result.accountId && result.accountName) {
          onAccountFound(result.accountId, result.accountName);
        }
      } else if (result.error) {
        setSearchStatus('error');
        setSearchError(result.message || 'Erreur lors de la recherche');
      } else {
        setSearchStatus('not-found');
      }
    } catch (err) {
      setSearchStatus('error');
      setSearchError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  // Can search if we have phone or email
  const canSearch = !!(data.phone || data.email || (data.firstName && data.lastName));

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

        {/* ─── Search Section ─────────────────────────────────────────────── */}
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSearch}
              disabled={!canSearch || searchStatus === 'searching'}
            >
              {searchStatus === 'searching' ? (
                <>
                  <span className="mr-2 animate-spin">⏳</span>
                  Recherche...
                </>
              ) : (
                <>
                  🔍 Rechercher le compte
                </>
              )}
            </Button>

            {/* Search Result Indicator */}
            {searchStatus === 'found' && searchResult && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                <span>✅</span>
                <span>
                  Compte trouvé: <strong>{searchResult.accountName}</strong>
                  {searchResult.matchedBy && (
                    <span className="ml-1 text-xs opacity-75">
                      (via {searchResult.matchedBy === 'phone' ? 'téléphone' : searchResult.matchedBy === 'email' ? 'email' : 'nom'})
                    </span>
                  )}
                </span>
              </div>
            )}

            {searchStatus === 'not-found' && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                <span>ℹ️</span>
                <span>Aucun compte trouvé — un nouveau compte sera créé</span>
              </div>
            )}

            {searchStatus === 'error' && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200">
                <span>❌</span>
                <span>{searchError || 'Erreur lors de la recherche'}</span>
              </div>
            )}
          </div>

          {/* Helper text */}
          {searchStatus === 'idle' && (
            <p className="mt-2 text-xs text-muted-foreground">
              Cliquez sur "Rechercher le compte" pour vérifier si le client existe déjà dans Salesforce.
              La recherche se fait par téléphone, puis par email, puis par nom.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
