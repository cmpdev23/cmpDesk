# Dossier Creation — UX Workflow

Documentation du processus utilisateur pour la création de dossiers dans cmpDesk.

---

## Vue d'ensemble

Le formulaire de création de dossier suit un **wizard multi-étapes** permettant de créer une **Opportunity** et un **Case** liés dans Salesforce.

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Étape 1    │────▶│  Recherche      │────▶│  Étape 2        │────▶│  Étape 3        │────▶│  Étape 4        │
│  Compte     │     │  Compte (auto)  │     │  Opportunity    │     │  Case           │     │  Documents      │
└─────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

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

## Étape 4 — Dépôt de documents

**Objectif**: Permettre à l'utilisateur d'ajouter des documents au dossier.

### Interface

| Élément | Description |
|---------|-------------|
| Zone de dépôt | Drag-and-drop avec indication visuelle |
| Bouton parcourir | Alternative au glisser-déposer |
| Liste des fichiers | Affiche les fichiers sélectionnés avec taille et type |

### Formats acceptés

| Type | Extensions |
|------|------------|
| Documents | .pdf, .doc, .docx, .txt |
| Tableurs | .xlsx, .xls |
| Images | .png, .jpg, .jpeg, .gif, .webp |

### Formats bloqués (sécurité)

- Exécutables (.exe, .bat, .cmd, .sh)
- Scripts (.js, .vbs, .ps1)
- Archives potentiellement dangereuses (.zip, .rar)

### Comportement

1. L'utilisateur peut glisser-déposer ou cliquer pour parcourir
2. Les fichiers valides sont ajoutés à la liste
3. Les fichiers non acceptés affichent un message d'erreur
4. Chaque fichier peut être supprimé individuellement
5. Bouton "Tout supprimer" si plusieurs fichiers

### Informations affichées par fichier

- Icône selon le type (📄 PDF, 📝 Word, 📊 Excel, 🖼️ Image)
- Nom du fichier (tronqué si trop long)
- Type de fichier
- Taille (KB/MB)
- Bouton de suppression

---

## Soumission

### Processus

1. Validation finale de tous les champs requis
2. Création de l'**Opportunity** dans Salesforce (liée au Account)
3. Création du **Case** (lié à l'Opportunity)
4. Affichage du résultat

### États de soumission

| État | UI |
|------|-----|
| En cours | Bouton désactivé + spinner |
| Succès | Card verte avec IDs créés |
| Erreur | Card rouge avec message d'erreur |

### Après succès

- Affichage de l'**Opportunity ID** et **Case ID**
- Bouton **"Créer un nouveau dossier"** pour recommencer

---

## Mode DEV

En mode développement (`DEV_MODE=true`):

- Indicateur visuel jaune en haut de page
- **Validation bypassée** si le formulaire est vide (inspection libre)
- Navigation entre étapes sans contrainte
- Panel debug avec état complet du formulaire

---

## Résumé du parcours utilisateur

```
1. Entrer infos client ──────▶ 2. Recherche auto ──────▶ 3. Choisir/Créer compte
                                                                    │
                                                                    ▼
7. Résultat création ◀────── 6. Soumission ◀────── 5. Documents ◀────── 4. Remplir Opportunity + Case
```

**Temps estimé**: 2-4 minutes pour un dossier complet.
