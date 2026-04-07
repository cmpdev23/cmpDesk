/**
 * @file src/modules/dossiers/components/DossierPageHeader.tsx
 * @description Page header for the Dossier creation flow.
 *
 * Displays the page title and the multi-step progress indicator.
 * Owned by the dossiers module — not a generic UI primitive.
 */

import { Stepper } from "@/components/ui/stepper";

const DOSSIER_STEPS = [
  { title: "Compte" },
  { title: "Informations générales" },
  { title: "Famille de produit" },
  { title: "Documents" },
  { title: "Notes" },
];

interface DossierPageHeaderProps {
  currentStep: number;
}

export function DossierPageHeader({ currentStep }: DossierPageHeaderProps) {
  return (
    <div className="p-2 border-b border-border bg-background">
      <div className="flex flex-col justify-between max-w-4xl gap-4 pl-4 md:flex-row md:items-center">
        <h1 className="text-xl font-bold text-foreground">Nouveau dossier</h1>

        <Stepper steps={DOSSIER_STEPS} currentStep={currentStep} />
      </div>
    </div>
  );
}
