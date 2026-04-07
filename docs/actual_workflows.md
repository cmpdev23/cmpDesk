# Dossier Creation — UX Workflow

Documentation du processus utilisateur pour la création de dossiers dans cmpDesk.

---

## Vue d'ensemble

Le formulaire de création de dossier suit un **wizard multi-étapes** permettant de créer une **Opportunity** et un **Case** liés dans Salesforce, puis d'uploader des documents vers **OpenText xECM**.

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Étape 1    │────▶│  Recherche      │────▶│  Étape 2        │────▶│  Étape 3        │────▶│  Soumission      │────▶│  Étape 4        │
│  Compte     │     │  Compte (auto)  │     │  Opportunity    │     │  Case           │     │  Salesforce      │     │  Documents      │
└─────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘     └──────────────────┘     └─────────────────┘
```

> **Ordre d'exécution critique** : Salesforce (Opportunity + Case) → obtention du `caseId` → Upload OpenText xECM

---

## Étape 1 — Infos Compte

**Objectif**: Collecter les informations de contact du client.

### Champs requis

| Champ     | Type   | Exemple           |
|-----------|--------|-------------------|
| Prénom    | text   | Jean              |
| Nom       | text   | Dupont            |
| Téléphone | tel    | 514-555-1234      |
| Email     | email  | client@exemple.com|

### Comportement

1. L'utilisateur remplit les 4 champs obligatoires
2. Le bouton **"Suivant"** devient actif
3. Au clic, le système déclenche automatiquement la recherche de compte

---

## Étape 1.5 — Recherche de Compte (automatique)

**Objectif**: Vérifier si le client existe déjà dans Salesforce et éviter les doublons.

### États possibles

| État | UI | Actions disponibles |
|------|-----|---------------------|
| **Recherche en cours** | Spinner animé | — |
| **Compte trouvé** | Card verte avec infos du compte | "Utiliser ce compte" / "Créer un nouveau" |
| **Plusieurs comptes** | Liste sélectionnable | Sélectionner un compte / "Créer un nouveau" |
| **Aucun compte** | Card ambrée avec message | "Créer un nouveau compte" |
| **Erreur** | Card rouge avec message d'erreur | "Précédent" / "Continuer sans recherche" |

### Flux de décision

```
                    ┌──────────────────┐
                    │ Recherche compte │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   ┌─────────┐         ┌──────────┐         ┌──────────┐
   │ Trouvé  │         │ Multiple │         │ Non trouvé│
   └────┬────┘         └────┬─────┘         └────┬─────┘
        │                   │                    │
        ▼                   ▼                    ▼
   Utiliser OU         Sélectionner OU      Créer nouveau
   Créer nouveau       Créer nouveau        compte
```

### Informations affichées (compte trouvé)

- Nom du compte
- Méthode de correspondance (téléphone/email/nom)
- ID Salesforce

---

## Étape 2 — Informations générales (Opportunity)

**Objectif**: Définir les paramètres de l'opportunité commerciale.

### Champs

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| Catégorie de l'opportunité | select | ✅ | Type d'opportunité |
| Produit d'intérêt | select | — | Produit concerné |
| Filiale | select | ✅ | Filiale responsable |
| Numéro de proposition | text | — | Ex: PROP-2026-001 |
| Numéro de contrat | text | — | Ex: CNT-2026-001 |
| Date de transaction | date | — | Date effective |
| Prime annuelle | number | — | Montant en $ |

### Validation

- **Catégorie** et **Filiale** sont obligatoires
- Navigation vers l'étape 3 bloquée si validation échoue

---

## Étape 3 — Informations du dossier (Case)

**Objectif**: Définir les paramètres de la transaction (Case lié à l'Opportunity).

### Champs avec dépendances en cascade

```
Famille de produit
    └─▶ Catégorie de transaction
            └─▶ Sous-catégorie de transaction
                    └─▶ Type de signature
                            └─▶ Type de produit
```

| Champ | Type | Requis | Dépendance |
|-------|------|--------|------------|
| Famille de produit | select | ✅ | — |
| Catégorie de transaction | select | ✅ | Famille de produit |
| Sous-catégorie de transaction | select | — | Catégorie |
| Type de signature | select | — | Sous-catégorie |
| Type de produit | select | — | Type de signature |
| Lieu de résidence du client | select | — | Indépendant |

### Comportement cascade

- Chaque champ enfant est **désactivé** tant que le parent n'est pas sélectionné
- Changer un parent **réinitialise** tous les enfants

---

## Soumission Salesforce (inter-étapes 3→4)

**Objectif**: Créer les enregistrements Salesforce avant l'upload de documents.

### Séquence d'exécution

```
Clic "Créer le dossier"
        │
        ▼
1. Créer Opportunity (Aura API)
        │ → opportunityId
        ▼
2. Lier Case à l'Opportunity (Aura API)
        │ → caseId  ← REQUIS pour xECM
        ▼
3. Retourner { success, opportunityId, caseId }
        │
        ▼
4. Naviguer vers Étape 4 (Documents)
```

### États de soumission Salesforce

| État | UI |
|------|-----|
| En cours | Bouton désactivé + spinner |
| Succès | Affichage des IDs → passage à l'étape 4 |
| Erreur | Card rouge avec message d'erreur |

### Après succès Salesforce

- **Opportunity ID** et **Case ID** sont disponibles
- L'étape 4 (documents) s'active avec le `caseId` comme contexte d'upload

---

## Étape 4 — Dépôt de documents (Upload OpenText xECM)

**Objectif**: Uploader les documents du dossier vers OpenText Content Server (xECM) lié au Case Salesforce.

### Prérequis

- `caseId` Salesforce valide (obtenu à l'étape de soumission)
- Session Salesforce active (browser context Playwright)

### Interface

| Élément | Description |
|---------|-------------|
| Zone de dépôt | Drag-and-drop avec indication visuelle |
| Bouton parcourir | Alternative au glisser-déposer |
| Liste des fichiers | Affiche les fichiers sélectionnés avec taille et type |

### Formats acceptés

| Type | Extensions |
|------|------------|
| Documents | `.pdf`, `.doc`, `.docx`, `.txt` |
| Tableurs | `.xlsx`, `.xls` |
| Images | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` |

### Formats bloqués (sécurité)

- Exécutables (`.exe`, `.bat`, `.cmd`, `.sh`)
- Scripts (`.js`, `.vbs`, `.ps1`)
- Archives potentiellement dangereuses (`.zip`, `.rar`)

### Limite de taille

- Maximum **50 MB** par fichier

### Comportement UI

1. L'utilisateur peut glisser-déposer ou cliquer pour parcourir
2. Les fichiers valides sont ajoutés à la liste
3. Les fichiers non acceptés affichent un message d'erreur inline
4. Chaque fichier peut être supprimé individuellement
5. Bouton "Tout supprimer" si plusieurs fichiers

### Informations affichées par fichier

- Icône selon le type (📄 PDF, 📝 Word, 📊 Excel, 🖼️ Image)
- Nom du fichier (tronqué si trop long)
- Type de fichier
- Taille (KB/MB)
- Bouton de suppression

### Flux technique d'upload (OpenText xECM)

```
Clic "Uploader les documents"
        │
        ▼
1. Acquérir mutex navigateur (BrowserOperationMutex)
        │
        ▼
2. Récupérer credentials Aura (captureAuraCredentials)
        │  → { token, context, sessionId }
        ▼
3. Résoudre workspace xECM via Aura API
        │  CanvasAppController.getPerspectiveParameters
        │  → { workspaceNodeId (parentNodeId) }
        ▼
4. Obtenir token OTDS via Aura API
        │  CanvasAppController.getPerspectiveParameters (avec caseId)
        │  → { otdsToken }
        ▼
5. Pour chaque fichier (séquentiel) :
        │  POST /otcs/cs.exe/api/v2/nodes
        │  Content-Type: multipart/form-data
        │  Authorization: Bearer {otdsToken}
        │  → { success, nodeId, fileName }
        │
        │  En cas de 401 → refresh otdsToken → retry automatique
        ▼
6. Libérer mutex
        │
        ▼
7. Retourner { uploadedCount, failedCount, results[] }
```

### États de l'upload

| État | UI |
|------|-----|
| En cours | Progress par fichier + spinner |
| Succès partiel | Fichiers uploadés en vert, échoués en rouge |
| Succès total | Card verte "X document(s) uploadé(s)" |
| Erreur totale | Card rouge avec message d'erreur |

### Résultat affiché

```json
{
  "uploadedCount": 4,
  "failedCount": 0,
  "results": [
    { "fileName": "contrat.pdf", "success": true, "nodeId": "12345678" },
    { "fileName": "identite.jpg", "success": true, "nodeId": "12345679" }
  ]
}
```

---

## Résumé du parcours utilisateur

```
1. Entrer infos client ──────▶ 2. Recherche auto ──────▶ 3. Choisir/Créer compte
                                                                    │
                                                                    ▼
                                                        4. Remplir Opportunity + Case
                                                                    │
                                                                    ▼
                                                        5. Soumission Salesforce
                                                           → Opportunity ID
                                                           → Case ID
                                                                    │
                                                                    ▼
8. Résultat final ◀────── 7. Upload xECM ◀────── 6. Déposer documents
```

**Temps estimé**: 2-4 minutes pour un dossier complet avec documents.

---

## Mode DEV

En mode développement (`DEV_MODE=true`):

- Indicateur visuel jaune en haut de page
- **Validation bypassée** si le formulaire est vide (inspection libre)
- Navigation entre étapes sans contrainte
- Panel debug avec état complet du formulaire

---

## Architecture technique

### IPC Handlers (electron/main.js)

| Handler IPC | Fonction | Description |
|-------------|----------|-------------|
| `salesforce:searchAccount` | `searchAccount()` | Recherche par téléphone/email/nom |
| `salesforce:createAccount` | `createAccount()` | Création compte FSC Individual |
| `salesforce:createDossier` | `createDossier()` | Création Opportunity + Case |
| `salesforce:uploadDocuments` | `uploadDocuments()` | Upload vers OpenText xECM ✅ |

### Protection contre les race conditions

Toutes les opérations navigateur sont sérialisées via `BrowserOperationMutex` :

```
searchAccount ──┐
createAccount ──┤──▶ BrowserOperationMutex (queue) ──▶ Playwright context
createDossier ──┤
uploadDocuments─┘
```

> Un seul accès au contexte navigateur à la fois. Les opérations concurrentes sont mises en file d'attente.

### Dépendances système

| Système | Usage |
|---------|-------|
| Salesforce Aura API | Création Opportunity, Case, résolution workspace xECM |
| OpenText OTDS | Authentification token pour l'API v2 |
| OpenText Content Server REST API v2 | Upload des documents (`POST /api/v2/nodes`) |
| Playwright (Chromium) | Session persistante, interception des credentials |
