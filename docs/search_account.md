# Salesforce Account Search API - Documentation Technique

## Vue d'ensemble

Ce document détaille l'implémentation de la recherche de comptes Salesforce via l'API Aura, utilisée par [`scripts/search_account.js`](../scripts/search_account.js).

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    search_account.js                         │
├─────────────────────────────────────────────────────────────┤
│  1. SessionManager.open()     → Browser avec cookies         │
│  2. ensureLightningLoaded()   → Gère SSO redirect            │
│  3. AuraClientV2.capture()    → Récupère fwuid + token       │
│  4. auraAction(getSuggestions)→ Recherche via API            │
│  5. page.goto(accountUrl)     → Navigation vers le compte    │
└─────────────────────────────────────────────────────────────┘
```

**Approche API-first**: Aucune interaction UI pour les opérations de données. Playwright est utilisé uniquement pour:
- Authentification
- Initialisation de session
- Capture des credentials Aura

---

## 2. API de recherche

### 2.1 Endpoint (Aura Action)

```javascript
descriptor: "serviceComponent://ui.search.components.forcesearch.assistant.AssistantSuggestionsDataProviderController/ACTION$getSuggestions"
```

### 2.2 Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| `term` | string | Terme de recherche (nom du compte) |
| `entityName` | string | Type d'objet à chercher (`"Account"`) |
| `maxRecords` | number | Nombre max de résultats (défaut: 10) |
| `maxQueries` | number | Suggestions de requêtes (0 pour désactiver) |
| `maxTips` | number | Conseils de recherche (0 pour désactiver) |
| `maxListViews` | number | Vues de liste (0 pour désactiver) |
| `context` | object | Contexte de filtres (`{ FILTERS: {} }`) |
| `configurationName` | string | Configuration (`"GLOBAL_SEARCH_BAR"`) |

### 2.3 Query Params

```javascript
queryParams: {
  "ui-search-components-forcesearch-assistant.AssistantSuggestionsDataProvider.getSuggestions": "1"
}
```

### 2.4 Exemple de requête complète

```javascript
const result = await client.auraAction({
  descriptor: "serviceComponent://ui.search.components.forcesearch.assistant.AssistantSuggestionsDataProviderController/ACTION$getSuggestions",
  params: {
    term: "Nick Suzuki",
    entityName: "Account",
    maxRecords: 10,
    maxQueries: 0,
    maxTips: 0,
    maxListViews: 0,
    context: { FILTERS: {} },
    configurationName: "GLOBAL_SEARCH_BAR",
  },
  queryParams: {
    "ui-search-components-forcesearch-assistant.AssistantSuggestionsDataProvider.getSuggestions": "1",
  },
});
```

---

## 3. Structure de la réponse

### 3.1 Structure globale

```javascript
{
  apiRequestId: "...",
  answers: [
    {
      type: "...",
      data: [
        {
          record: { Id, Name, Phone, sobjectType, ... },
          scopeMap: { color, icon, label, keyPrefix, ... }
        }
      ]
    }
  ],
  times: {...},
  summaryTimes: {...}
}
```

### 3.2 Structure des records

Les records sont **imbriqués** dans `answers[0].data[i].record`:

```javascript
{
  "record": {
    "Id": "001JQ00001AqmDbYAJ",
    "Name": "Nick Suzuki",
    "Phone": "8193332623",
    "DisambiguationField": "8193332623",
    "sobjectType": "Account"
  },
  "scopeMap": {
    "color": "5867E8",
    "icon": "https://indall.my.salesforce.com/img/icon/t4v35/standard/account_120.png",
    "nameField": "Name",
    "label": "Compte",
    "keyPrefix": "001"
  }
}
```

### 3.3 Extraction des records

```javascript
let records = [];

if (result.returnValue.answers) {
  const answers = result.returnValue.answers;
  if (Array.isArray(answers)) {
    for (const answer of answers) {
      // Structure: { type: "...", data: [...] }
      if (answer.data && Array.isArray(answer.data)) {
        records.push(...answer.data);
      }
    }
  }
}

// Accéder au record réel (structure imbriquée)
for (const item of records) {
  const record = item.record || item;  // ← IMPORTANT!
  console.log(record.Id, record.Name);
}
```

---

## 4. Gestion SSO

### 4.1 Problème

Salesforce peut afficher une page SSO intermédiaire (`indall.my.salesforce.com`) même avec des cookies valides.

### 4.2 Solution

Le module [`auth/salesforce_sso.js`](../auth/salesforce_sso.js) fournit:

```javascript
import { ensureLightningLoaded } from "../auth/salesforce_sso.js";

const result = await ensureLightningLoaded(page, {
  timeout: 60_000,
  loadWait: 3_000,
  verbose: true,
});

if (result.success) {
  // Lightning est prêt
} else {
  console.error(result.error);
}
```

### 4.3 Fonctions disponibles

| Fonction | Description |
|----------|-------------|
| `isOnSsoPage(page)` | Détecte si on est sur la page SSO |
| `isOnLightning(page)` | Détecte si on est sur Lightning |
| `handleSsoRedirect(page, opts)` | Clique sur le bouton SSO |
| `ensureLightningLoaded(page, opts)` | Point d'entrée principal |

---

## 5. Filtrage des résultats

### 5.1 Par correspondance de nom

```javascript
const nameParts = searchName.toLowerCase().split(" ");

for (const item of records) {
  const record = item.record || item;
  const recordName = record.Name.toLowerCase();
  
  if (nameParts.every(part => recordName.includes(part))) {
    return record.Id;  // Correspondance trouvée
  }
}
```

### 5.2 Par type d'objet (prefix ID)

Les IDs Salesforce ont un préfixe de 3 caractères indiquant le type:

| Préfixe | Type |
|---------|------|
| `001` | Account |
| `003` | Contact |
| `006` | Opportunity |
| `00Q` | Lead |

```javascript
const accountRecords = records.filter(item => {
  const record = item.record || item;
  const id = record.Id || "";
  return id.startsWith("001");  // Accounts uniquement
});
```

---

## 6. URL du compte

### Format Lightning

```
https://{instance}.lightning.force.com/lightning/r/Account/{recordId}/view
```

### Construction

```javascript
const accountUrl = `https://indall.lightning.force.com/lightning/r/Account/${recordId}/view`;
await page.goto(accountUrl, { waitUntil: "domcontentloaded" });
```

---

## 7. Gestion des erreurs

### 7.1 Aura non disponible

```javascript
if (!(await client.isAuraAvailable())) {
  await page.waitForTimeout(5_000);  // Attendre le chargement
  // Réessayer...
}
```

### 7.2 Aucun résultat

Le script tente une recherche alternative sans filtre `entityName`:

```javascript
// Recherche alternative (tous types d'objets)
const result = await client.auraAction({
  descriptor: "serviceComponent://ui.search.components.forcesearch.assistant.AssistantSuggestionsDataProviderController/ACTION$getSuggestions",
  params: {
    term: searchName,
    // Pas de entityName → recherche globale
    maxRecords: 20,
    // ...
  },
});
```

---

## 8. Usage

### 8.1 Ligne de commande

```bash
# Recherche par défaut (Nick Suzuki depuis seeds)
node scripts/search_account.js

# Recherche personnalisée
node scripts/search_account.js "John Doe"
```

### 8.2 Programmatique

```javascript
import { searchAndOpenAccount } from "./scripts/search_account.js";

const result = await searchAndOpenAccount("Nick Suzuki");

console.log(result);
// {
//   success: true,
//   accountName: "Nick Suzuki",
//   accountId: "001JQ00001AqmDbYAJ",
//   accountUrl: "https://indall.lightning.force.com/lightning/r/Account/001JQ00001AqmDbYAJ/view",
//   error: null
// }
```

---

## 9. Fichiers de référence

| Fichier | Description |
|---------|-------------|
| [`scripts/search_account.js`](../scripts/search_account.js) | Script principal de recherche |
| [`auth/salesforce_sso.js`](../auth/salesforce_sso.js) | Gestion SSO redirect |
| [`auth/salesforce_aura_v2.js`](../auth/salesforce_aura_v2.js) | Client Aura avec capture credentials |
| [`auth/session_manager.js`](../auth/session_manager.js) | Gestion session browser |
| [`scripts/seeds/account.js`](../scripts/seeds/account.js) | Données de test (Nick Suzuki) |

---

## 10. Découvertes (2026-04-02)

1. **Descriptor recherche**: `AssistantSuggestionsDataProviderController/ACTION$getSuggestions`
2. **Structure réponse**: Records imbriqués dans `answers[0].data[i].record`
3. **SSO handling**: Nécessaire même avec cookies valides
4. **Fallback**: Recherche alternative sans filtre entityName si premier essai échoue

---

## Historique

| Date | Changement |
|------|------------|
| 2026-04-02 | Création du script et documentation |
| 2026-04-02 | Découverte structure `answers[0].data[i].record` |
| 2026-04-02 | Ajout module `salesforce_sso.js` pour SSO redirect |
