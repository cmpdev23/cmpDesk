/**
 * @file src/modules/dossiers/components/AccountSearchStep.tsx
 * @description Intermediate step showing account search results
 *
 * This component is shown after the user fills in account info and clicks "Next".
 * It displays the search results and allows the user to:
 * - Use an existing account (if found)
 * - Create a new account (regardless of search result)
 * - Go back to modify the account info
 *
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AccountSearchResult } from "@/types/electron";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchStepStatus = 'searching' | 'found' | 'not-found' | 'error';

interface AccountSearchStepProps {
  /** Current search status */
  status: SearchStepStatus;
  /** Search result from Salesforce API */
  searchResult: AccountSearchResult | null;
  /** Error message if status is 'error' */
  errorMessage?: string;
  /** Called when user wants to use the found account */
  onUseAccount: () => void;
  /** Called when user wants to create a new account */
  onCreateNew: () => void;
  /** Called when user wants to go back to edit account info */
  onPrevious: () => void;
}

/**
 * Intermediate step component for displaying account search results.
 * Shows appropriate UI based on whether an account was found or not.
 */
export function AccountSearchStep({
  status,
  searchResult,
  errorMessage,
  onUseAccount,
  onCreateNew,
  onPrevious,
}: AccountSearchStepProps) {
  // ─── Searching State ────────────────────────────────────────────────────────
  if (status === 'searching') {
    return (
      <Card className="pl-1 border border-border ring-0">
        <CardHeader>
          <CardTitle>Recherche du compte...</CardTitle>
          <CardDescription>
            Vérification si le client existe déjà dans Salesforce
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">
                Recherche en cours...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Error State ────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <Card className="pl-1 border border-red-200 dark:border-red-900 ring-0">
        <CardHeader>
          <CardTitle className="text-red-700 dark:text-red-400">
            Erreur de recherche
          </CardTitle>
          <CardDescription>
            Une erreur est survenue lors de la recherche du compte
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30">
            <p className="text-sm text-red-700 dark:text-red-300">
              {errorMessage || 'Erreur inconnue lors de la recherche'}
            </p>
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" onClick={onPrevious}>
              ← Précédent
            </Button>
            <Button variant="outline" onClick={onCreateNew}>
              Continuer sans recherche
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Account Found State ────────────────────────────────────────────────────
  if (status === 'found' && searchResult?.found) {
    return (
      <Card className="pl-1 border border-green-200 dark:border-green-900 ring-0">
        <CardHeader>
          <CardTitle className="text-green-700 dark:text-green-400">
            ✅ Compte existant trouvé
          </CardTitle>
          <CardDescription>
            Un compte correspondant a été trouvé dans Salesforce
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account Info Display */}
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Nom du compte:
                </span>
                <span className="text-base font-semibold text-green-800 dark:text-green-200">
                  {searchResult.accountName}
                </span>
              </div>
              {searchResult.matchedBy && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Trouvé via:
                  </span>
                  <span className="text-sm text-green-700 dark:text-green-300">
                    {searchResult.matchedBy === 'phone' && 'Téléphone'}
                    {searchResult.matchedBy === 'email' && 'Email'}
                    {searchResult.matchedBy === 'name' && 'Nom'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  ID Salesforce:
                </span>
                <code className="px-2 py-0.5 text-xs rounded bg-muted">
                  {searchResult.accountId}
                </code>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={onUseAccount} className="flex-1">
              Utiliser ce compte →
            </Button>
            <Button variant="outline" onClick={onCreateNew} className="flex-1">
              Créer un nouveau compte
            </Button>
          </div>

          {/* Go back link */}
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={onPrevious}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              ← Modifier les informations du compte
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Account Not Found State ────────────────────────────────────────────────
  return (
    <Card className="pl-1 border border-amber-200 dark:border-amber-900 ring-0">
      <CardHeader>
        <CardTitle className="text-amber-700 dark:text-amber-400">
          ℹ️ Aucun compte trouvé
        </CardTitle>
        <CardDescription>
          Aucun compte existant ne correspond aux informations fournies
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info Message */}
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Les informations fournies ne correspondent à aucun compte existant
            dans Salesforce. Vous pouvez créer un nouveau compte ou revenir en
            arrière pour modifier les informations de recherche.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={onPrevious} className="flex-1">
            ← Précédent
          </Button>
          <Button onClick={onCreateNew} className="flex-1">
            Créer un nouveau compte →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
