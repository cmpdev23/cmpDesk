/**
 * @file src/modules/dossiers/components/NotesStep.tsx
 * @description Step for adding notes in the Opportunity creation form
 *
 * Allows users to add free-text notes related to the dossier.
 * This step comes after the document upload step.
 *
 * Design System: shadcn/ui (radix-lyra preset)
 */

import { type ChangeEvent } from "react";
import { StickyNote } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Notes step data
 */
export interface NotesStepData {
  notes: string;
}

interface NotesStepProps {
  data: NotesStepData;
  onChange: (data: NotesStepData) => void;
  errors?: Record<string, string>;
}

/**
 * Maximum character limit for notes
 */
const MAX_NOTES_LENGTH = 5000;

/**
 * Notes Step component.
 * Provides a textarea for adding notes to the dossier.
 */
export function NotesStep({ data, onChange, errors = {} }: NotesStepProps) {
  /**
   * Handle textarea change
   */
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    // Enforce max length
    if (value.length <= MAX_NOTES_LENGTH) {
      onChange({ ...data, notes: value });
    }
  };

  const characterCount = data.notes.length;
  const isNearLimit = characterCount > MAX_NOTES_LENGTH * 0.9;

  return (
    <Card className="pl-1 border border-border ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StickyNote className="w-5 h-5" />
          Étape 5 — Notes
        </CardTitle>
        <CardDescription>
          Ajoutez des notes ou commentaires pour ce dossier (optionnel)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Textarea */}
        <div className="space-y-2">
          <textarea
            id="notes"
            name="notes"
            value={data.notes}
            onChange={handleChange}
            placeholder="Entrez vos notes ici... (informations complémentaires, instructions spéciales, etc.)"
            className={`
              w-full min-h-[350px] p-4
              text-sm rounded-lg resize-y
              bg-background border
              placeholder:text-muted-foreground/60
              focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${
                errors.notes
                  ? "border-red-500 dark:border-red-400"
                  : "border-input"
              }
            `}
            aria-label="Notes du dossier"
            aria-describedby="notes-description notes-counter"
          />

          {/* Character counter */}
          <div className="flex items-center justify-between">
            <p id="notes-description" className="text-xs text-muted-foreground">
              Les notes seront enregistrées avec le dossier
            </p>
            <span
              id="notes-counter"
              className={`text-xs ${
                isNearLimit
                  ? "text-amber-600 dark:text-amber-400 font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {characterCount.toLocaleString()} /{" "}
              {MAX_NOTES_LENGTH.toLocaleString()} caractères
            </span>
          </div>
        </div>

        {/* Error message */}
        {errors.notes && (
          <div className="p-3 text-sm text-red-700 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/30 dark:border-red-900 dark:text-red-400">
            {errors.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Default data for notes step
 */
export const DEFAULT_NOTES_DATA: NotesStepData = {
  notes: "",
};
