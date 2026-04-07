# Case (Dossier) — Documentation Technique

## Vue d'ensemble

Le **Case** est un objet Salesforce standard qui, dans le contexte iA CRM, représente un **dossier de transaction** lié à une Opportunity.

> ✅ **Découverte (2026-04-02)**: Le Case est **créé automatiquement** par un trigger SF lors de la création de l'Opportunity. Le Screen Flow qui s'ouvre sert uniquement à **mettre à jour** le Case existant, pas à le créer.

---

## Object Metadata

| Propriété | Valeur |
|-----------|--------|
| **API Name** | `Case` |
| **Label** | Requête |
| **Label Plural** | Requêtes |
| **Key Prefix** | `500` |
| **Total Fields** | 76 |
| **Total Picklists** | 11 |

---

## RecordTypes Disponibles

| RecordTypeId | Name | Default | Notes |
|--------------|------|---------|-------|
| `012Am0000004KaPIAU` | **Transaction** | ✅ Oui | RecordType principal pour les dossiers |
| `012JQ000004AQlJYAW` | ORDC | Non | Pour le workflow ORDC |
| `012000000000000AAA` | Principal | Non | Master RecordType |

---

## Workflow Réel

```
1. Opportunity créée (API ou UI)
       ↓
2. Trigger SF → Case auto-créé (vide)
       ↓
3. Opportunity.Case__c = Case ID (lookup)
       ↓
4. Screen Flow → Met à jour les champs du Case
```

**Implication**: Utiliser `updateCase()` au lieu de `createCase()`.

---

## Relation avec Opportunity

```
Opportunity
    └── Case__c (Lookup vers Case)
    └── Case__r.* (Champs accessibles via relation)
    └── CaseProductFamily__c (Formula depuis Case)
    └── CaseTransactionCategory__c (Formula depuis Case)
```

### Champs Formula sur Opportunity (depuis Case)

| Champ Opportunity | Source Case |
|-------------------|-------------|
| `CaseProductFamily__c` | `Case__r.Product_Family__c` |
| `CaseTransactionCategory__c` | `Case__r.Transaction_Category__c` |

---

## Flow de Création

### Screen Flow: `Opportunity_UpdateCaseInformation`

Ce Flow est déclenché automatiquement lorsqu'on navigue vers une Opportunity qui n'a pas encore de Case associé.

**Déclencheur:**
- Controller Apex: `ORDCVerificationCTRL.getCaseInfo(oppId)`
- Vérifie si un Case existe pour l'Opportunity
- Si non → lance le Flow

**Aura Descriptor:**
```
aura://FlowRuntimeConnectController/ACTION$startFlow
```

**Arguments:**
```json
{
  "flowDevName": "Opportunity_UpdateCaseInformation",
  "arguments": "[{\"name\":\"recordId\",\"type\":\"String\",\"value\":\"<OpportunityId>\"}]"
}
```

---

## Champs Principaux (76 champs)

### Champs Clés du Flow (Picklists)

| Label UI (FR) | API Name | Type | Required | Updateable |
|---------------|----------|------|----------|------------|
| Famille de produit | `Product_Family__c` | Picklist | Non | Oui |
| Catégorie de transaction | `Transaction_Category__c` | Picklist | Non | Oui |
| Sous-catégorie de transaction | `Transaction_Sub_Category__c` | Picklist | Non | Oui |
| Type de signature | `SignatureType__c` | Picklist | Non | Oui |
| Lieu de résidence du client | `CustomersPlaceOfResidence__c` | Picklist | Non | Oui |
| Type de Produit | `ProductType__c` | Picklist | Non | Oui |

### Champs Standard

| Label | API Name | Type | Required | Updateable |
|-------|----------|------|----------|------------|
| Numéro de la requête | `CaseNumber` | String | Oui | Non (auto) |
| Objet | `Subject` | String | Non | Oui |
| Statut | `Status` | Picklist | Non | Oui |
| Description | `Description` | TextArea | Non | Oui |
| Commentaires internes | `Comments` | TextArea | Non | Oui |
| ID du propriétaire | `OwnerId` | Reference | Oui | Oui |
| ID du compte | `AccountId` | Reference | Non | Oui |
| Opportunité | `Opportunity__c` | Reference | Non | Oui |
| Date de création | `CreatedDate` | DateTime | Oui | Non (auto) |

### Champs Additionnels

| Label | API Name | Type | Updateable |
|-------|----------|------|------------|
| Filiale | `Subsidiary__c` | Picklist | Oui |
| Police d'assurance | `Contract__c` | Reference | Oui |
| Suivi requis | `FollowUpRequired__c` | Boolean | Oui |
| Commentaires de suivi | `FollowUpComments__c` | String | Oui |
| Date/Heure de vérification | `Date_Time_Verified__c` | DateTime | Oui |
| Regulatory Obligation | `IsCompliant__c` | Boolean | Oui |
| Rappel | `Reminder__c` | DateTime | Oui |
| Premier avis | `FirstWarning__c` | DateTime | Oui |
| Deuxième avis | `SecondWarning__c` | DateTime | Oui |

---

## Valeurs Picklist Complètes (Extraites 2026-04-02)

### Product_Family__c

| Value API | Label (FR) |
|-----------|------------|
| `Insurance` | Assurance |
| `Saving` | Épargne |

### Transaction_Category__c

> ⚠️ **Contrôlé par**: `Product_Family__c`

| Value API | Label (FR) | Valid For |
|-----------|------------|-----------|
| `Changes_Insurance` | Changement (Assurance) | Insurance |
| `Changes_Saving` | Changement (Épargne) | Saving |
| `Contributions` | Contributions | Saving |
| `Correction` | Correction | Saving |
| `New application` | Nouvelle adhésion | Saving |
| `Loan` | Prêt | Saving |
| `Repurchase` | Rachat | Saving |
| `Death claim` | Règlement décès | Saving |
| `New Contract` | Nouveau Contrat | Insurance |
| `Other` | Autre | Insurance, Saving |

### Transaction_Sub_Category__c

> ⚠️ **Contrôlé par**: `Transaction_Category__c`

| Value API | Label (FR) | Valid For |
|-----------|------------|-----------|
| `Enrolment with transfer in` | Adhésion avec transfert entrant | New application |
| `RESP Enrolment` | Adhésion REEE | New application |
| `Add protection/changing type of protection (13 months)` | Ajout de protection/changement type de protection (13 mois) | Changes_Insurance, New Contract |
| `Advisor Change` | Changement de représentant | Changes_Saving |
| `Conversion` | Conversion | Changes_Saving |
| `Surrender Correction` | Correction rachat | Correction |
| `Subsequent deposit` | Dépôt subséquent | Contributions |
| `Financial` | Financière | Correction |
| `PAD stop or change` | Modification ou arrêt de DPA | Changes_Saving |
| `Non-financial` | Non-financière | Correction |
| `Payment` | Paiement | Death claim |
| `RESP` | REEE | Loan |
| `RRSP` | REER | Loan |
| `Settlement without benefit SPIA` | Règlement sans bénéfice - RPU | Death claim |
| `External Replacement` | Remplacement Externe | Changes_Insurance, New Contract |
| `Internal Replacement` | Remplacement Interne | Changes_Insurance, New Contract |
| `RESP Surrender` | Retrait REEE | Repurchase |
| `Regular surrender` | Retrait régulier | Repurchase |
| `Rollover` | Roulement | Death claim |
| `Without Replacement` | Sans remplacement | Changes_Insurance, New Contract |
| `Transfer` | Transfert | Death claim |
| `Incoming transfer` | Transfert entrant | Contributions |
| `Transfer In RESP` | Transfert entrant REEE | Contributions |
| `Transfer between contracts` | Transfert intercontrats | Changes_Saving |
| `Inter-fund, inter-series, intracontract transfer` | Transfert interfonds, interséries, intracontrat | Changes_Saving |
| `Transformation` | Transformation | Changes_Insurance, New Contract |
| `Other` | Autre | Changes_Insurance, Changes_Saving, Contributions, Correction, Loan, Death claim |
| `Other enrolment` | Tout autre adhésion | New application |

### SignatureType__c

> ⚠️ **Contrôlé par**: `Transaction_Sub_Category__c`

| Value API | Label (FR) | Valid For |
|-----------|------------|-----------|
| `Electronic` | Électronique | Enrolment with transfer in, RESP Enrolment, Add protection/changing type of protection (13 months), Without Replacement, Other enrolment |
| `Paper` | Papier | Enrolment with transfer in, RESP Enrolment, Add protection/changing type of protection (13 months), Conversion, External Replacement, Internal Replacement, Without Replacement, Transformation, Other enrolment |
| `EVO` | EVO | External Replacement, Internal Replacement |

### CustomersPlaceOfResidence__c

| Value API | Label (FR) |
|-----------|------------|
| `Outside Quebec` | Hors Québec |
| `Quebec` | Québec |

### ProductType__c

> ⚠️ **Contrôlé par**: `SignatureType__c`

| Value API | Label (FR) | Valid For |
|-----------|------------|-----------|
| `Critical Illness Insurance` | Assurance Maladie Grave | Electronic, Paper |
| `Life Insurance` | Assurance Vie | Electronic, Paper |
| `Life Insurance With Investment` | Assurance vie avec investissement | Electronic, Paper |
| `iA PAR` | iA PAR | Electronic, Paper |

### Status

| Value API | Label (FR) | Default |
|-----------|------------|---------|
| `New` | Nouveau | ✅ Oui |
| `Awaiting Validation` | En attente de validation | |
| `Validated` | Validé | |
| `Awaiting Corrections` | En attente de correction | |
| `Awaiting Verification` | En attente de vérification | |
| `Rejected` | Refusé | |
| `Contract ended` | Contrat terminé | |
| `Cancelled` | Annulée | |
| `Completed` | Complet | |

### Subsidiary__c

| Value API | Label (FR) |
|-----------|------------|
| `iA` | iA |
| `Excellence` | Excellence |
| `PPI` | PPI |
| `Investia` | Investia |
| `MRA` | MRA |
| `Other` | Autre |

### Language

| Value API | Label (FR) |
|-----------|------------|
| `en_US` | Anglais |
| `fr` | Français |

### CurrentTypeTask__c

| Value API | Label (FR) |
|-----------|------------|
| `Reminder` | Rappel |
| `First Warning` | Premier avis |
| `Second Warning` | Deuxième avis |

### StatusReason__c

| Value API | Label (FR) |
|-----------|------------|
| `Advisor Absent` | Conseiller absent |
| `Advisor on Disability Leave` | Conseiller en invalidité |

---

## Dépendances de Picklists (Cascade)

```
Product_Family__c
    └── contrôle → Transaction_Category__c
                       └── contrôle → Transaction_Sub_Category__c
                                          └── contrôle → SignatureType__c
                                                             └── contrôle → ProductType__c
```

### Exemple de combinaison valide (Assurance - Nouveau contrat)

```javascript
{
  Product_Family__c: "Insurance",
  Transaction_Category__c: "New Contract",         // validFor: Insurance
  Transaction_Sub_Category__c: "Without Replacement", // validFor: New Contract
  SignatureType__c: "Electronic",                  // validFor: Without Replacement
  ProductType__c: "Life Insurance",                // validFor: Electronic
  CustomersPlaceOfResidence__c: "Quebec"           // Indépendant
}
```

---

## API pour Création/Update

### Picklist Values

```javascript
// Descriptor
"aura://RecordUiController/ACTION$getPicklistValuesByRecordType"

// Params
{
  "objectApiName": "Case",
  "recordTypeId": "012Am0000004KaPIAU"
}
```

### Get Case ID from Opportunity

```javascript
// Descriptor
"aura://RecordUiController/ACTION$getRecordWithFields"

// Params
{
  "recordId": "<OpportunityId>",
  "fields": ["Opportunity.Case__c"]
}

// Response: fields.Case__c.value = "<CaseId>"
```

### Update Case ✅ (Testé et fonctionnel)

```javascript
// Descriptor
"aura://RecordUiController/ACTION$updateRecord"

// Params - ATTENTION: recordId requis au niveau params
{
  "recordId": "<CaseId>",  // ← REQUIRED at params level
  "recordInput": {
    "allowSaveOnDuplicate": false,
    "fields": {
      "Id": "<CaseId>",
      "Product_Family__c": "Insurance",
      "Transaction_Category__c": "New Contract",
      "Transaction_Sub_Category__c": "Without Replacement",
      "SignatureType__c": "Electronic",
      "CustomersPlaceOfResidence__c": "Quebec",
      "ProductType__c": "Life Insurance"
    }
  }
}
```

> ⚠️ **Note**: Ne pas inclure `Opportunity__c` ou `RecordTypeId` dans l'update — ils sont déjà définis lors de l'auto-création.

---

## Automatisation

### ✅ Option 1 — Via API UPDATE (Recommandé & Testé)

1. Créer l'Opportunity via API
2. **Le Case est auto-créé par trigger SF**
3. Récupérer le Case ID: `Opportunity.Case__c`
4. Mettre à jour le Case via `updateRecord`

**Code:**
```javascript
import { updateCaseFromOpportunity } from "../lib/update_case.js";

const result = await updateCaseFromOpportunity(client, opportunityId, {
  Product_Family__c: "Insurance",
  Transaction_Category__c: "New Contract",
  Transaction_Sub_Category__c: "Without Replacement",
  SignatureType__c: "Electronic",
  CustomersPlaceOfResidence__c: "Quebec",
  ProductType__c: "Life Insurance",
});
```

**Avantages:**
- ✅ Rapide
- ✅ Pas de dépendance UI
- ✅ Testé et fonctionnel
- ✅ Respecte le workflow SF (trigger + update)

**Inconvénients:**
- Nécessite de respecter les dépendances de picklists

### Option 2 — Via Flow API

1. Créer l'Opportunity via API
2. Appeler `startFlow` avec `Opportunity_UpdateCaseInformation`
3. Naviguer les écrans via `navigateFlow`

**Avantages:**
- Respecte la logique métier du Flow
- Valeurs par défaut gérées

**Inconvénients:**
- Plus complexe à implémenter
- Dépend de la structure du Flow

### Option 3 — Via UI (Playwright)

1. Créer l'Opportunity via API
2. Naviguer vers le record (déclenche le Flow popup)
3. Remplir le Flow via Playwright

**Avantages:**
- Simple à implémenter
- Visuel pour debug

**Inconvénients:**
- Lent
- Fragile (sélecteurs peuvent changer)

---

## Lib Functions Disponibles

| Fonction | Fichier | Description |
|----------|---------|-------------|
| `getCaseIdFromOpportunity()` | `lib/update_case.js` | Récupère le Case ID depuis Opportunity.Case__c |
| `updateCase()` | `lib/update_case.js` | Met à jour un Case existant |
| `updateCaseFromOpportunity()` | `lib/update_case.js` | Combine les deux opérations |
| `buildCaseFields()` | `scripts/seeds/case.js` | Génère les champs de test |

---

## Scripts Disponibles

| Script | Description |
|--------|-------------|
| `scripts/inspect_case_fields.js` | Extraction complète des champs et picklists Case |
| `scripts/update_opportunity.js` | Test interactif: navigue vers Opportunity existante et teste les opérations Case |
| `scripts/main.js` | Orchestrateur complet: Opportunity → Case (Milestone 2) |
| `inspectors/case/inspect_case_picklist_api.js` | Inspector API pour les picklists Case |

---

## Références

- **Rapport d'inspection complet**: `inspectors/reports/case/case_complete_fields.json`
- **Rapport picklists**: `inspectors/reports/case/case_picklists.json`
- **Flow API Name**: `Opportunity_UpdateCaseInformation`
- **Controller Apex**: `ORDCVerificationCTRL`
- **Lib Update Case**: `lib/update_case.js`
- **Seeds Case**: `scripts/seeds/case.js`

---

## TODO

- [x] ~~Tester la mise à jour de Case via API~~ ✅ Fonctionnel
- [x] ~~Documenter la séquence complète Opportunity + Case~~ ✅
- [x] ~~Créer inspector pour obtenir tous les champs Case~~ ✅ 2026-04-02
- [x] ~~Créer inspector pour obtenir toutes les valeurs picklist~~ ✅ 2026-04-02
- [ ] Identifier les champs requis vs optionnels par validation rule
- [ ] Documenter les combinaisons de picklists valides complètes
