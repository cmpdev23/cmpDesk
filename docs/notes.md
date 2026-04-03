# Notes (ContentNote) — Documentation technique

## Vue d'ensemble

Les Notes dans Salesforce sont stockées en tant que `ContentNote`, un type spécial de `ContentDocument`.
La création d'une Note liée à un Case nécessite **deux appels API** :

1. **Créer le ContentNote** — via `RecordGvpController/ACTION$saveRecord`
2. **Lier au Case** — via `EditPanelController/ACTION$serverCreateUpdate`

---

## API — Création de ContentNote

### Descriptor

```
serviceComponent://ui.force.components.controllers.recordGlobalValueProvider.RecordGvpController/ACTION$saveRecord
```

### Payload Structure

```javascript
{
  recordRep: {
    id: null,                    // null pour création
    apiName: "ContentNote",
    fields: {
      Id: { value: null },
      Title: { value: "Titre de la note" },
      Content: { value: "<base64 encoded HTML>" },
      OwnerId: { value: "<User ID>" },
      SharingPrivacy: { value: "N" }
    },
    recordTypeInfo: null
  },
  recordSaveParams: {
    bypassAsyncSave: true
  }
}
```

### Champs ContentNote

| Champ | Type | Description | Exemple |
|-------|------|-------------|---------|
| `Title` | String | Titre de la note | `"Informations client"` |
| `Content` | Base64 | Contenu HTML encodé en Base64 | `"PHA+VGV4dGU8L3A+"` |
| `OwnerId` | ID (18 chars) | ID de l'utilisateur propriétaire | `"005JQ000005SQNKYA4"` |
| `SharingPrivacy` | String | `"N"` = Normal, `"P"` = Private | `"N"` |

### Encodage du contenu (Base64)

Le contenu est du HTML encodé en Base64 :

```javascript
// JavaScript - Encoder
const htmlContent = "<p>Ceci est ma note</p>";
const base64Content = Buffer.from(htmlContent).toString('base64');
// Résultat: "PHA+Q2VjaSBlc3QgbWEgbm90ZTwvcD4="

// JavaScript - Décoder
const decoded = Buffer.from(base64Content, 'base64').toString('utf-8');
// Résultat: "<p>Ceci est ma note</p>"
```

**Exemples courants :**

| HTML | Base64 |
|------|--------|
| `<p></p>` (vide) | `PHA+PC9wPg==` |
| `<p>Test</p>` | `PHA+VGVzdDwvcD4=` |
| `<p>Bonjour</p>` | `PHA+Qm9uam91cjwvcD4=` |

### Réponse attendue

```javascript
{
  state: "SUCCESS",
  returnValue: {
    id: "069JQ00000s0UF8YAM",  // ContentNote ID créé
    // ... autres champs
  }
}
```

---

## API — Liaison au Case (ou autre record)

### Descriptor

```
serviceComponent://ui.notes.components.aura.components.editPanel.EditPanelController/ACTION$serverCreateUpdate
```

### Payload Structure

```javascript
{
  noteId: "069JQ00000s0UF8YAM",    // ID du ContentNote
  title: "",                        // Peut rester vide
  textContent: "",                  // Texte brut (optionnel)
  richTextContent: "",              // Rich text (optionnel)
  noteChanged: false,               // false si on ne modifie pas le contenu
  relatedIdsChanged: true,          // true pour ajouter des liens
  relatedIds: ["500JQ00000xut34YAA"] // Array des IDs à lier
}
```

### Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| `noteId` | ID | ID du ContentNote à lier |
| `title` | String | Nouveau titre (ou vide) |
| `textContent` | String | Contenu texte brut |
| `richTextContent` | String | Contenu rich text HTML |
| `noteChanged` | Boolean | `true` si le contenu est modifié |
| `relatedIdsChanged` | Boolean | `true` si on modifie les liens |
| `relatedIds` | Array<ID> | Liste des IDs de records à lier |

---

## Workflow complet

```
┌──────────────────────────────────────────────────────────────┐
│                    CRÉATION D'UNE NOTE                        │
└──────────────────────────────────────────────────────────────┘

1. Appel API: RecordGvpController/saveRecord
   ├─ Input: { apiName: "ContentNote", fields: { Title, Content, ... } }
   └─ Output: { id: "069JQ00000s0UF8YAM" }  ← ContentNote ID

2. Appel API: EditPanelController/serverCreateUpdate
   ├─ Input: { noteId: "069...", relatedIds: ["500..."], relatedIdsChanged: true }
   └─ Output: { success: true }

Résultat:
   ContentNote (069...) ─────►linked to────► Case (500...)
                              via ContentDocumentLink
```

---

## Entités Salesforce impliquées

```
ContentNote (069)
    │
    ├── Title: String
    ├── Content: Base64 HTML
    ├── OwnerId: User ID
    └── SharingPrivacy: N/P

         │
         │ (linked via)
         ▼

ContentDocumentLink
    │
    ├── ContentDocumentId: ContentNote ID
    ├── LinkedEntityId: Case ID (ou autre)
    └── ShareType: V (Viewer) / C (Collaborator)

         │
         │ (points to)
         ▼

Case (500)
    └── AttachedContentNotes (related list)
```

---

## Exemple d'implémentation (lib/create_note.js)

```javascript
/**
 * Crée une Note et la lie à un record (Case, Opportunity, etc.)
 * 
 * @param {AuraClientV2} client - Client Aura initialisé
 * @param {Object} options
 * @param {string} options.title - Titre de la note
 * @param {string} options.htmlContent - Contenu HTML (sera encodé en Base64)
 * @param {string} options.linkedRecordId - ID du record auquel lier la note
 * @param {string} [options.ownerId] - ID du propriétaire (optionnel)
 */
async function createNote(client, { title, htmlContent, linkedRecordId, ownerId }) {
  // 1. Encoder le contenu en Base64
  const base64Content = Buffer.from(htmlContent).toString('base64');
  
  // 2. Créer le ContentNote
  const createResult = await client.auraAction({
    descriptor: "serviceComponent://ui.force.components.controllers.recordGlobalValueProvider.RecordGvpController/ACTION$saveRecord",
    params: {
      recordRep: {
        id: null,
        apiName: "ContentNote",
        fields: {
          Id: { value: null },
          Title: { value: title },
          Content: { value: base64Content },
          OwnerId: { value: ownerId || client.userId },
          SharingPrivacy: { value: "N" }
        },
        recordTypeInfo: null
      },
      recordSaveParams: { bypassAsyncSave: true }
    }
  });
  
  if (!createResult.success) {
    return { success: false, error: createResult.error };
  }
  
  const noteId = createResult.returnValue?.id;
  
  // 3. Lier au record cible
  const linkResult = await client.auraAction({
    descriptor: "serviceComponent://ui.notes.components.aura.components.editPanel.EditPanelController/ACTION$serverCreateUpdate",
    params: {
      noteId: noteId,
      title: "",
      textContent: "",
      richTextContent: "",
      noteChanged: false,
      relatedIdsChanged: true,
      relatedIds: [linkedRecordId]
    }
  });
  
  return {
    success: linkResult.success,
    noteId: noteId,
    linkedRecordId: linkedRecordId,
    error: linkResult.error
  };
}
```

---

## Références

- **Inspector script**: `inspectors/case/inspect_note_creation.js`
- **Rapport capturé**: `inspectors/reports/case/note_creation_inspection.json`
- **Related List dans SF**: `AttachedContentNotes`
- **Key Prefix**: `069` (ContentNote)

---

## Anti-patterns

- ❌ Ne pas essayer de créer un `ContentDocumentLink` directement — utiliser l'API `serverCreateUpdate`
- ❌ Ne pas oublier d'encoder le HTML en Base64
- ❌ Ne pas envoyer du texte brut dans `Content` — doit être du HTML valide
- ❌ Ne pas utiliser `networkidle` pour attendre — utiliser `domcontentloaded` + timeout
