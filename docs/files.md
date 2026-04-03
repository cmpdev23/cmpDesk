# Document Upload - xECM (OpenText Extended ECM)

## 🎯 SERVEUR OPENTEXT IDENTIFIÉ (2026-04-02)

| Composant | URL / Valeur |
|-----------|--------------|
| **OpenText Content Server** | `https://otcs.ia.ca/cs/cs/` |
| **Canvas App Endpoint** | `https://otcs.ia.ca/cs/cs/xecmsf/canvas` |
| **Node API** | `https://otcs.ia.ca/cs/cs/app/nodes/{nodeId}` |
| **OTDS SSO** | `https://otds.ia.ca/` |
| **Workspace Node (Case)** | `147266903` |
| **Auth Token Format** | `*OTDSSSO*{base64_encoded_token}` |

---

## 🚨 Découverte Majeure

L'upload de documents dans Salesforce **n'utilise PAS** l'API native Salesforce Files.
Le système utilise **xECM (OpenText Extended ECM)** intégré via Canvas App.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      SALESFORCE LIGHTNING                            │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                       CASE PAGE                                 ││
│  │                                                                 ││
│  │  ┌──────────────────────────────────────────────────────────┐  ││
│  │  │              xECM CANVAS APP (iframe)                     │  ││
│  │  │                                                           │  ││
│  │  │   ┌─────────────────────────────────────────────────────┐│  ││
│  │  │   │         MICROSOFT SSO LOGIN (Blocked)               ││  ││
│  │  │   │                                                     ││  ││
│  │  │   │   ❌ login.microsoftonline.com n'autorise pas       ││  ││
│  │  │   │      la connexion dans un iframe                    ││  ││
│  │  │   │      (X-Frame-Options: DENY)                        ││  ││
│  │  │   │                                                     ││  ││
│  │  │   └─────────────────────────────────────────────────────┘│  ││
│  │  │                                                           │  ││
│  │  │   → Nécessite ouverture dans nouvel onglet               │  ││
│  │  │   → Authentification Microsoft séparée                   │  ││
│  │  │                                                           │  ││
│  │  └──────────────────────────────────────────────────────────┘  ││
│  │                                                                 ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────────┐
              │        OpenText ECM Server        │
              │                                   │
              │   • Stockage documents            │
              │   • Versioning                    │
              │   • Metadata                      │
              │   • Microsoft Graph API           │
              │                                   │
              └───────────────────────────────────┘
```

---

## Descripteurs Aura Capturés

Les appels xECM passent par des contrôleurs Apex spécifiques:

```
apex://xecm.CanvasAppController/ACTION$getCanvasApp
apex://xecm.CanvasAppController/ACTION$getPerspectiveParameters
apex://xecm.CanvasAppController/ACTION$isAutoWorkspaceCreateEnabled
apex://xecm.CanvasAppController/ACTION$isUserLicensed
serviceComponent://ui.force.components.controllers.canvasApp.CanvasAppController/ACTION$getCanvasAppData
```

---

## 🔑 Données Critiques Capturées (2026-04-02)

### Canvas App Details

| Propriété | Valeur |
|-----------|--------|
| **Canvas App Name** | `OpenTextApp` |
| **Signed Request API** | `PUT /services/data/v66.0/platformconnect/signedrequest?canvas=OpenTextApp` |
| **Trace Event API** | `POST /services/data/v66.0/platformconnect/traceevent` |
| **API Version** | v66.0 |

### getPerspectiveParameters Payload

```json
{
  "recordId": "500JQ00000xut34YAA",
  "removeCSHeader": false,
  "perspectiveType": "Workspace",
  "parameters": ""
}
```

### Objets Custom xECM dans Salesforce

Le package xECM a installé de nombreux objets custom:

```
xecm__BatchOrgwideSynchronization__c
xecm__BusinessObjectRoleMemberResolvers__c
xecm__BusinessObjectType__c
xecm__BusinessObjectWorkspace__c      ← Clé pour le lien Case↔Workspace
xecm__BusinessProcessSchedule__c
xecm__BusinessProcessTask__c
xecm__BusinessProcess__c
xecm__BusinessPropertyGroup__c
xecm__BusinessPropertyInfo__c
xecm__BusinessPropertyPath__c
xecm__BusinessRelationshipPath__c
xecm__BusinessRelationship__c
xecm__BusinessTask__c
xecm__CriteriaSharingRulePredicate__c
xecm__CriteriaSharingRule__c
xecm__EventConfiguration__c
xecm__EventErrorQueue__c
xecm__EventQueue__c
xecm__EventUpdateQueue__c
xecm__FeedMetadataQueue__c
xecm__FeedNode__c
xecm__FeedUpdateQueue__c
xecm__LogConfiguration__c
xecm__LogMessage__c
xecm__ObjectSharing__c
xecm__OwnerSharingRule__c
xecm__Schedule__c
xecm__SchedulerQueue__c
xecm__UserInformationAttributeMap__c
xecm__UserInformationProvider__c
xecm__soqlPredicateExpression__c
xecm__soqlPredicate__c
```

### Ressource CSS chargée

```
https://indall.lightning.force.com/resource/1678369477000/xecm__largemodalcss
```

---

## 🎯 Prochaine Investigation: Capturer les Réponses

Le script actuel capture les **requêtes** mais pas les **réponses** des appels xECM.

Pour trouver l'URL du serveur OpenText, il faut capturer les réponses de:

1. `apex://xecm.CanvasAppController/ACTION$getCanvasApp` → Contient probablement l'URL du serveur
2. `PUT /services/data/v66.0/platformconnect/signedrequest?canvas=OpenTextApp` → Signed Request avec URL de callback

### Script Amélioré Nécessaire

Créer `inspectors/case/inspect_xecm_responses.js` qui:
- Capture les **corps de réponse** des appels xECM
- Parse les signed requests Canvas
- Extrait l'URL du serveur OpenText

---

## Problème d'Authentification

### Symptôme

Lorsqu'on ouvre la gestion documentaire dans le Case, on voit:
```
login.microsoftonline.com n'autorise pas la connexion.
```

### Cause

- Le Canvas App xECM s'exécute dans un **iframe**
- L'iframe tente de charger la page de login Microsoft
- Microsoft bloque les connexions dans les iframes via `X-Frame-Options: DENY`
- C'est une mesure de sécurité contre le clickjacking

### Implications pour l'Automatisation

1. **Pas d'accès via Playwright standard** - L'iframe est bloqué
2. **Authentification Microsoft séparée requise** - MSAL/OAuth2 flow
3. **API xECM/OpenText à investiguer** - Endpoints REST probables

---

## Pistes d'Investigation

### Option 1: API xECM REST Directe

OpenText Content Server expose généralement une API REST:
- `POST /api/v1/nodes` - Créer un document
- `PUT /api/v1/nodes/{id}/content` - Upload contenu
- Headers: `Authorization: Bearer <token>`

**Nécessite:**
- URL du serveur OpenText (probablement `*.ia.ca` ou `*.inalco.com`)
- Token d'authentification Microsoft/OpenText

### Option 2: Salesforce Connect / External Object

Si le lien SF↔xECM passe par un External Data Source:
- Peut-être des objets Salesforce externes (`__x`)
- API Salesforce standard pourrait fonctionner

### Option 3: Microsoft Graph API

Si les documents sont stockés dans SharePoint/OneDrive:
- API Microsoft Graph pour l'upload
- OAuth2 via Azure AD

### Option 4: Capture des appels xECM

Ouvrir xECM dans un nouvel onglet (pas iframe) et capturer:
- Les endpoints REST utilisés
- Les headers d'authentification
- Le format de payload

---

## ✅ Upload Réussi (2026-04-02)

### Test Results

| Document | Node ID | Size | Status |
|----------|---------|------|--------|
| DOCUMENT_1.pdf | 147292342 | 12,618 bytes | ✅ Uploaded |
| DOCUMENT_2.pdf | 147329598 | 12,238 bytes | ✅ Uploaded |
| DOCUMENT_3.pdf | 147343832 | 12,638 bytes | ✅ Uploaded |

### API Call Details

```http
POST https://otcs.ia.ca/cs/cs/api/v2/nodes
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
OTDSTicket: *OTDSSSO*{base64_token}
Accept: application/json

------WebKitFormBoundary...
Content-Disposition: form-data; name="type"

144
------WebKitFormBoundary...
Content-Disposition: form-data; name="parent_id"

147266903
------WebKitFormBoundary...
Content-Disposition: form-data; name="name"

DOCUMENT_1.pdf
------WebKitFormBoundary...
Content-Disposition: form-data; name="file"; filename="DOCUMENT_1.pdf"
Content-Type: application/pdf

{file_content}
------WebKitFormBoundary...--
```

### Response Structure

```json
{
  "links": { "data": { "self": { "href": "/api/v2/nodes", "method": "POST" } } },
  "results": {
    "data": {
      "properties": {
        "id": 147292342,
        "name": "DOCUMENT_1.pdf",
        "type": 144,
        "type_name": "Document",
        "mime_type": "application/pdf",
        "size": 12618,
        "parent_id": 147266903,
        "create_date": "2026-04-02T21:43:13Z",
        "owner": "Vincent Cochrane Services Financie, Rs Inc",
        "owner_user_id": 920854
      }
    }
  }
}
```

### Key Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `type` | 144 | OpenText Document type |
| `parent_id` | Workspace Node ID | Case-linked workspace |
| `name` | filename | Document name |
| `file` | binary | PDF content |

---

## Prochaines Étapes

1. [x] ~~Identifier l'URL du serveur OpenText/xECM~~ → `https://otcs.ia.ca/cs/cs/`
2. [x] ~~Comprendre le flow d'authentification Microsoft (MSAL)~~ → Token capturé via xECM Canvas App
3. [x] ~~Capturer les appels API xECM dans un onglet séparé~~ → Token dans proxy.jsp URL
4. [x] ~~Tester l'API REST OpenText avec token capturé~~ → ✅ 3/3 documents uploadés
5. [ ] Développer `lib/upload_document.js` fonction stable pour main.js

---

## Fichiers Associés

- `inspectors/case/inspect_document_upload.js` - Script d'inspection (capture initiale)
- `inspectors/reports/case/document_upload_inspection.json` - Rapport de capture

---

## Références

- [OpenText Extended ECM for Salesforce](https://www.opentext.com/products/extended-ecm-for-salesforce)
- [Microsoft Identity Platform - iframes](https://learn.microsoft.com/en-us/azure/active-directory/develop/reference-breaking-changes#embedded-iframe)
- [Salesforce Canvas App](https://developer.salesforce.com/docs/atlas.en-us.platform_connect.meta/platform_connect/canvas_framework_intro.htm)
