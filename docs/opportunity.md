# Opportunity — Champs Salesforce FSC

> Généré via `inspectors/opportunity/inspect_opportunity_creation.js` le 2026-04-02
> Mis à jour via `inspectors/opportunity/inspect_opportunity_simple.js` le 2026-04-02
> **Étape 2 ajoutée**: 2026-04-02 (Famille de produit)
> **Étape 3 ajoutée**: 2026-04-02 (Type de signature)
> RecordTypeId: `012Am0000004KaZIAU`
> Formulaire multi-étapes: Oui (création via modal Flow UI - 3 étapes identifiées)

---

## 🎯 Vue d'ensemble

L'Opportunity dans Salesforce FSC (Financial Services Cloud) est créée via un formulaire multi-étapes accessible depuis la page Account.

### Étapes du formulaire UI (Flow Modal)

| Étape | Contenu | Champs principaux |
|-------|---------|-------------------|
| **Étape 1** | Informations générales | Catégorie, Étape, Filiale, Dates, Lookups |
| **Étape 2** | Famille de produit | Famille, Catégorie transaction, Sous-catégorie, Objet |
| **Étape 3** | Type de signature | Type signature, Type produit, Lieu résidence client |

### Séquence API sous-jacente

1. **Vérification du RecordType** — `doRecordTypeCheck`
2. **Récupération des picklists** — `getPicklistValuesByRecordType`
3. **Création du record** — `createRecord`

---

## ✅ Champs requis pour la création (validés via inspection)

| Champ API         | Type      | Requis | Valeur exemple              | Notes                          |
|-------------------|-----------|--------|-----------------------------|--------------------------------|
| `AccountId`       | Reference | **oui**| `001JQ00001AqmDbYAJ`       | ID du compte parent            |
| `Name`            | String    | **oui**| —                           | Nom de l'opportunité (auto?)   |
| `StageName`       | Picklist  | **oui**| `Closed Won`               | Étape du pipeline              |
| `CloseDate`       | Date      | **oui**| `2026-04-01`               | Date de clôture prévue         |
| `RecordTypeId`    | Reference | **oui**| `012Am0000004KaZIAU`       | Type d'enregistrement FSC      |
| `OwnerId`         | Reference | non    | `005JQ000005SQNKYA4`       | Propriétaire (défaut: user courant) |
| `Probability`     | Percent   | non    | `100`                       | Probabilité de succès          |

---

## 🏷️ Champs personnalisés FSC (Custom Fields)

### Champs financiers

| Champ API                          | Type     | Sample           | Notes                              |
|------------------------------------|----------|------------------|------------------------------------|
| `Annual_Premium__c`                | Currency | `1`              | Prime annuelle                     |
| `Initial_Investment_Amount__c`     | Currency | `null`           | Montant investissement initial     |
| `Periodic_Amount__c`               | Currency | `null`           | Montant périodique                 |
| `Actual_Sales_Credit__c`           | Currency | `null`           | Crédit de vente réel               |
| `Override_Estimated_Sales_Credit__c`| Boolean | `false`          | Remplacer crédit estimé            |

### Champs produit/contrat

| Champ API                    | Type     | Sample            | Notes                              |
|------------------------------|----------|-------------------|------------------------------------|
| `Product_Interest__c`        | Picklist | `Life Insurance`  | Produit d'intérêt                  |
| `Opportunity_Category__c`    | Picklist | `Gobal Offer`     | Catégorie (typo dans SF?)          |
| `Contract_Number__c`         | String   | `test`            | Numéro de contrat                  |
| `Contract_Renewal_Date__c`   | Date     | `null`            | Date de renouvellement             |
| `Proposal_Number__c`         | String   | `test`            | Numéro de proposition              |
| `Frequency__c`               | Picklist | `null`            | Fréquence de paiement              |
| `Subsidiary__c`              | Picklist | `iA`              | Filiale (iA, etc.)                 |
| `Transaction_Date__c`        | Date     | `null`            | Date de transaction                |

### Champs référence/relation

| Champ API                       | Type      | Sample | Notes                              |
|---------------------------------|-----------|--------|------------------------------------|
| `FinServ__ReferredByContact__c` | Reference | `null` | Contact référent                   |
| `FinServ__ReferredByUser__c`    | Reference | `null` | Utilisateur référent               |
| `Related_Opportunity__c`        | Reference | `null` | Opportunité liée                   |

### Champs source/raison

| Champ API            | Type     | Sample | Notes                              |
|----------------------|----------|--------|------------------------------------|
| `LeadSource`         | Picklist | `null` | Source du lead (standard SF)       |
| `Lead_Source_Other__c`| String  | `null` | Autre source (si `Other`)          |
| `Loss_Reason__c`     | Picklist | `null` | Raison de perte                    |

### Champs standard SF

| Champ API     | Type     | Sample | Notes                              |
|---------------|----------|--------|------------------------------------|
| `Amount`      | Currency | `null` | Montant de l'opportunité           |
| `Description` | TextArea | `null` | Description libre                  |

---

## 🔄 Flow de création API (séquence capturée)

### Étape 1: Vérification RecordType

```javascript
// Descriptor: serviceComponent://...CreateRecordTypeCheckerController/ACTION$doRecordTypeCheck
{
  entityApiName: "Opportunity",
  defaultFieldValues: {
    AccountId: "001JQ00001AqmDbYAJ"
  },
  navigationLocation: "RELATED_LIST",
  navigationLocationId: "Opportunities",
  removeAnimations: false,
  inContextOfRecordId: "001JQ00001AqmDbYAJ",
  parentObjectApiName: "PersonAccount",
  createRecordPanelTitle: null
}
```

### Étape 2: Vérification support UI API

```javascript
// Descriptor: ...CreateRecordTypeCheckerController/ACTION$isEntityUiApiSupported
{
  parentRecordId: "001JQ00001AqmDbYAJ"
}
```

### Étape 3: Récupération des picklists

```javascript
// Descriptor: aura://RecordUiController/ACTION$getPicklistValuesByRecordType
{
  objectApiName: "Opportunity",
  recordTypeId: "012Am0000004KaZIAU"
}
```

### Étape 4: Création du record

```javascript
// Descriptor: aura://RecordUiController/ACTION$createRecord
{
  recordInput: {
    apiName: "Opportunity",
    fields: {
      AccountId: "001JQ00001AqmDbYAJ",
      StageName: "Closed Won",
      CloseDate: "2026-04-01",
      Probability: 100,
      OwnerId: "005JQ000005SQNKYA4",
      RecordTypeId: "012Am0000004KaZIAU",
      // ... autres champs
    }
  }
}
```

---

## 📊 Statistiques de l'inspection

| Métrique              | Valeur |
|-----------------------|--------|
| Total appels Aura     | 176    |
| Appels metadata       | 4      |
| Appels création       | 3      |
| Descripteurs uniques  | 71     |

---

## 🎯 Descripteurs clés pour automatisation

| Action                    | Descriptor                                                        |
|---------------------------|-------------------------------------------------------------------|
| Créer record              | `aura://RecordUiController/ACTION$createRecord`                   |
| Récupérer picklists       | `aura://RecordUiController/ACTION$getPicklistValuesByRecordType`  |
| Récupérer info objet      | `aura://RecordUiController/ACTION$getObjectInfos`                 |
| Récupérer UI record       | `aura://RecordUiController/ACTION$getRecordUis`                   |
| Vérifier RecordType       | `serviceComponent://...CreateRecordTypeCheckerController/ACTION$doRecordTypeCheck` |

---

## 🛠️ Exemple de création via Aura API

```javascript
const result = await client.auraAction({
  descriptor: "aura://RecordUiController/ACTION$createRecord",
  params: {
    recordInput: {
      apiName: "Opportunity",
      fields: {
        AccountId: accountId,
        Name: "Nouvelle opportunité",
        StageName: "Prospecting",
        CloseDate: "2026-12-31",
        RecordTypeId: "012Am0000004KaZIAU",
        Product_Interest__c: "Life Insurance",
        Subsidiary__c: "iA"
      }
    }
  }
});
```

---

## ⚠️ Points d'attention

1. **Formulaire multi-étapes** — Le formulaire UI est un flow multi-étapes, mais l'API `createRecord` accepte tous les champs en une seule requête.

2. **`Opportunity_Category__c`** — Contient une typo dans les valeurs (`Gobal Offer` au lieu de `Global Offer`). Utiliser la valeur exacte de Salesforce.

3. **RecordTypeId obligatoire** — Sans RecordTypeId, la création peut échouer ou utiliser un type par défaut incorrect.

4. **Champs null** — Beaucoup de champs acceptent `null`. Les champs avec `_type: "object"` et `_sample: null` sont optionnels.

5. **Probabilité auto-calculée** — La `Probability` peut être automatiquement ajustée selon le `StageName` choisi.

---

## 🖥️ Champs UI du formulaire de création (extraits via DOM)

> Extrait via `inspect_opportunity_simple.js` le 2026-04-02

### Picklists (Comboboxes) — 6 champs

| Label UI | Champ API probable | Requis |
|----------|-------------------|--------|
| Catégorie de l'opportunité | `Opportunity_Category__c` | **oui** |
| Étape | `StageName` | **oui** |
| Raison de perte | `Loss_Reason__c` | non |
| Produit d'intérêt | `Product_Interest__c` | non |
| Filiale | `Subsidiary__c` | **oui** |
| Origine du lead | `LeadSource` | non |

### Inputs — 7 champs

| Label UI | Champ API probable | Requis |
|----------|-------------------|--------|
| Date de clôture planifiée | `CloseDate` | **oui** |
| Probabilité (%) | `Probability` | non |
| Remplacer le crédit de vente estimé | `Override_Estimated_Sales_Credit__c` | non |
| Numéro de proposition | `Proposal_Number__c` | non |
| Numéro de contrat | `Contract_Number__c` | non |
| Date de transaction | `Transaction_Date__c` | non |
| Date de renouvellement | `Contract_Renewal_Date__c` | non |

### Textarea — 1 champ

| Label UI | Champ API probable | Requis |
|----------|-------------------|--------|
| Description | `Description` | non |

### Lookups — 4 champs

| Label UI | Champ API probable | Requis |
|----------|-------------------|--------|
| Nom du compte | `AccountId` | **oui** |
| Opportunité connexe | `Related_Opportunity__c` | non |
| Référent interne | `FinServ__ReferredByUser__c` | non |
| Référent externe | `FinServ__ReferredByContact__c` | non |

---

## 🖥️ Étape 2 — Champs Famille de produit (extraits via DOM)

> Extrait via `inspect_opportunity_simple.js` le 2026-04-02
> Screenshot: `inspectors/reports/opportunity_form_capture.png`

### Picklists (Comboboxes) — 3 champs

| Label UI | Champ API probable | Requis | Notes |
|----------|-------------------|--------|-------|
| Famille de produit | `Product_Family__c` | **oui** | Détermine les options Catégorie/Sous-Catégorie |
| Catégorie de transaction | `Transaction_Category__c` | **oui** | Dépendant de Famille de produit |
| Sous-Catégorie de transaction | `Transaction_Sub_Category__c` | **oui** | Dépendant de Catégorie de transaction |

### Inputs — 2 champs

| Label UI | Champ API probable | Type | Requis | Notes |
|----------|-------------------|------|--------|-------|
| Remplacer le crédit de vente estimé | `Override_Estimated_Sales_Credit__c` | Checkbox | non | Aussi présent dans Étape 1 |
| Objet | `Name` | Text | **oui** | Nom de l'opportunité (généré auto si vide) |

### Notes sur l'Étape 2

1. **Picklists dépendantes** — Les 3 picklists forment une cascade:
   - Famille de produit → filtre → Catégorie de transaction
   - Catégorie de transaction → filtre → Sous-Catégorie de transaction

2. **Champ Objet** — C'est le champ `Name` standard de l'Opportunity. Peut être auto-généré selon la config SF.

3. **Checkpoint** — Le champ "Remplacer le crédit de vente estimé" apparaît dans les deux étapes, ce qui suggère un field visibility rule.

---

## 🖥️ Étape 3 — Type de signature (extraits via DOM)

> Extrait via `inspect_opportunity_simple.js` le 2026-04-02
> Screenshot: `inspectors/reports/opportunity_form_capture.png`

### Picklists (Comboboxes) — 3 champs

| Label UI | Champ API probable | Requis | Notes |
|----------|-------------------|--------|-------|
| Type de signature de la proposition | `Proposal_Signature_Type__c` | **oui** | Type de signature (électronique, papier, etc.) |
| Type de Produit | `Product_Type__c` | **oui** | Type de produit spécifique |
| Lieu de résidence du client | `Client_Residence_Location__c` | **oui** | Province/région du client |

### Inputs — 3 champs

| Label UI | Champ API probable | Type | Requis | Notes |
|----------|-------------------|------|--------|-------|
| Remplacer le crédit de vente estimé | `Override_Estimated_Sales_Credit__c` | Checkbox | non | Présent dans toutes les étapes |
| Make Primary | `Make_Primary__c` | Checkbox | non | Marquer comme opportunité principale |
| Objet | `Name` | Text | **oui** | Nom de l'opportunité (persisté à travers les étapes) |

### Notes sur l'Étape 3

1. **Dernière étape avant soumission** — Cette étape semble être la dernière avant la création finale de l'Opportunity.

2. **Champs récurrents** — Les champs "Remplacer le crédit de vente estimé" et "Objet" apparaissent dans plusieurs étapes, suggérant qu'ils sont toujours visibles/modifiables.

3. **Nouveaux champs identifiés** — `Make_Primary__c` est un champ qui n'apparaît que dans cette étape finale.

---

## 📁 Rapports générés

| Fichier | Contenu |
|---------|---------|
| `inspectors/reports/opportunity_creation_flow.json` | Flow complet avec 176 appels Aura |
| `inspectors/reports/opportunity_form_capture.png` | Screenshot du formulaire de création |
| `inspectors/reports/opportunity_form_structure.json` | Structure des champs UI |

---

## 📊 Valeurs Picklist API (extraits via API)

> Extrait via [`inspectors/opportunity/inspect_opportunity_picklist_api.js`](../inspectors/opportunity/inspect_opportunity_picklist_api.js) le 2026-04-02
> RecordTypeId: `012Am0000004KaZIAU`
> Report: [`inspectors/reports/opportunity/opportunity_picklists.json`](../inspectors/reports/opportunity/opportunity_picklists.json)

### `Product_Interest__c` — Produit d'intérêt (18 valeurs)

| Value (API) | Label (FR) |
|-------------|------------|
| `Group Insurance` | Assurance Collective |
| `Children and Dependants Insurance` | Assurance Enfants/Personnes à Charge |
| `Disability Insurance` | Assurance Invalidité |
| `Critical Illness Insurance` | Assurance Maladie Grave |
| `Loan Insurance` | Assurance Prêt |
| `Life Insurance` | Assurance Vie |
| `Travel Insurance` | Assurance Voyage |
| `FHSA` | CELIAPP |
| `TFSA` | CELI |
| `LIRA` | CRI |
| `RRIF` | FERR |
| `LIF` | FRV |
| `RESP` | REEE |
| `RRSP` | REER |
| `Non-registered Savings` | Epargne Non-enregistré |
| `Mortgage Loan Referral` | Référence Prêt Hypothécaire |
| `Home and Auto Insurance Referral` | Référence IAAH |
| `Referral` | Référence |

### `Opportunity_Category__c` — Catégorie de l'opportunité (12 valeurs)

| Value (API) | Label (FR) |
|-------------|------------|
| `Gobal Offer` | Offre Globale |
| `Update/Investor Profile` | Mise à jour/Profil investisseur |
| `Market Analysis` | Analyse de marché |
| `Birth` | Naissance |
| `Buying a house` | Achat de maison |
| `Mortgage loan` | Prêt hypothécaire |
| `Retirement` | Retraite |
| `Insurance` | Assurance |
| `Savings` | Epargne |
| `IAAH` | IAAH |
| `Large case solutions` | Solutions cas avancées |
| `Business Solutions` | Solutions Entreprise |

> ⚠️ Note: `Gobal Offer` est une typo dans Salesforce (devrait être `Global Offer`). Utiliser la valeur exacte.

### `Subsidiary__c` — Filiale (6 valeurs)

| Value (API) | Label (FR) |
|-------------|------------|
| `iA` | iA |
| `Excellence` | Excellence |
| `PPI` | PPI |
| `Investia` | Investia |
| `MRA` | MRA |
| `Other` | Autre |

---

## 🔗 Références

- Inspector API: [`inspectors/opportunity/inspect_opportunity_creation.js`](../inspectors/opportunity/inspect_opportunity_creation.js)
- Inspector UI: [`inspectors/opportunity/inspect_opportunity_simple.js`](../inspectors/opportunity/inspect_opportunity_simple.js)
- Inspector Picklists: [`inspectors/opportunity/inspect_opportunity_picklist_api.js`](../inspectors/opportunity/inspect_opportunity_picklist_api.js)
- Lib search: [`lib/search_account.js`](../lib/search_account.js)
- Lib create opportunity: [`lib/create_opportunity.js`](../lib/create_opportunity.js)
- Lib form extractor: [`lib/form_extractor.js`](../lib/form_extractor.js)
- Report: [`inspectors/reports/opportunity_creation_flow.json`](../inspectors/reports/opportunity_creation_flow.json)
- Report Picklists: [`inspectors/reports/opportunity/opportunity_picklists.json`](../inspectors/reports/opportunity/opportunity_picklists.json)
- Aura client: [`auth/salesforce_aura_v2.js`](../auth/salesforce_aura_v2.js)

---

## 📝 TODO

- [x] Extraire les champs UI du formulaire de création (Étape 1)
- [x] Extraire les champs UI du formulaire de création (Étape 2 - Famille de produit)
- [x] Extraire les champs UI du formulaire de création (Étape 3 - Type de signature)
- [x] Extraire les valeurs picklist exactes pour `Product_Interest__c`, `Opportunity_Category__c`, `Subsidiary__c`
- [ ] Extraire les valeurs picklist pour `Product_Family__c`, `Transaction_Category__c`, `Transaction_Sub_Category__c`
- [ ] Extraire les valeurs picklist pour `Proposal_Signature_Type__c`, `Product_Type__c`, `Client_Residence_Location__c`
- [x] Créer `lib/opportunity.js` avec fonction `createOpportunity()`
- [x] Créer `scripts/seeds/opportunity.js` pour tests automatisés
- [ ] Valider les champs obligatoires via test de création API directe
