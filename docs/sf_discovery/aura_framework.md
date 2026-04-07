# Salesforce Aura Framework - Documentation Technique

## Vue d'ensemble

Salesforce Lightning Experience utilise le **Aura Framework** pour la communication client-serveur. Ce document détaille les découvertes techniques pour interagir programmatiquement avec cette API.

---

## 1. Architecture de l'API Aura

### Endpoint
```
POST https://{instance}.lightning.force.com/aura?r={sequence}&{query_params}
```

### Format de requête
```
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

message={json_encoded_message}
&aura.context={json_encoded_context}
&aura.token={csrf_token}
```

### Format de réponse
```javascript
// La réponse est préfixée avec un anti-hijacking marker
*/{"actions":[...],"context":{...}}/*
```

---

## 2. Les 3 éléments critiques d'une requête Aura

### 2.1 Message (actions)

Structure JSON définissant les actions à exécuter:

```javascript
{
    "actions": [{
        "id": "1;a",                    // Identifiant unique de l'action
        "descriptor": "aura://RecordUiController/ACTION$createRecord",
        "callingDescriptor": "UNKNOWN",
        "params": {
            // Paramètres spécifiques à l'action
        }
    }]
}
```

### 2.2 Aura Context

Contexte du framework Lightning - **OBLIGATOIRE**:

```javascript
{
    "mode": "PROD",                     // Mode du framework
    "fwuid": "TXFWNVpr...",            // Framework UID - CRITIQUE
    "app": "one:one",                   // Application Lightning
    "loaded": {...},                    // Composants chargés
    "dn": [],
    "globals": {},
    "uad": false
}
```

**⚠️ IMPORTANT:** Le `fwuid` doit correspondre exactement à la version du serveur sinon erreur `clientOutOfSync`.

### 2.3 Aura Token (CSRF)

Token anti-CSRF - **OBLIGATOIRE pour les actions modificatrices**:

```
aura.token=eyJhbGciOiJIUzI1NiIs...
```

**⚠️ IMPORTANT:** La valeur `"undefined"` cause une erreur `invalidSession`.

---

## 3. Erreurs courantes et solutions

### 3.1 `aura:clientOutOfSync`

**Message:**
```
Framework has been updated. Expected: TXFWNVpr... Actual: null
```

**Cause:** Le `fwuid` envoyé ne correspond pas au serveur.

**Solution:** Capturer le `fwuid` depuis une vraie requête Aura native.

### 3.2 `aura:invalidSession`

**Message:**
```
Expected 3 tokens in ...
```

**Cause:** Le `aura.token` est invalide ou manquant.

**Solution:** Capturer le token depuis une vraie requête Aura native.

### 3.3 `Réponse Aura sans actions`

**Cause:** La réponse ne contient pas de tableau `actions[]`.

**Diagnostic:** Vérifier si la réponse contient un `event` au lieu d'actions (indique une erreur).

---

## 4. Obfuscation du framework en production

### Problème

En production, Salesforce **obfusque** les noms de méthodes JavaScript:

```javascript
// En développement
ctx.getEncodedFWUID()

// En production (obfusqué)
ctx.ys()  // ou autre nom aléatoire
```

### Conséquence

**Il est impossible** d'extraire le `fwuid` via `$A.getContext().fwuid` ou `$A.getContext().getEncodedFWUID()` en production.

### Solution

**Capturer les credentials depuis les requêtes Aura natives** en interceptant le trafic réseau.

---

## 5. Solution: Capture par interception

### Principe

```javascript
page.on("request", (request) => {
    if (request.url().includes("/aura") && request.method() === "POST") {
        const postData = request.postData();
        const params = new URLSearchParams(postData);
        
        // Capturer le contexte
        const context = JSON.parse(params.get("aura.context"));
        const fwuid = context.fwuid;  // ← Valeur valide!
        
        // Capturer le token
        const token = params.get("aura.token");  // ← Token valide!
    }
});
```

### Implémentation

Voir [`auth/salesforce_aura_v2.js`](../auth/salesforce_aura_v2.js) pour l'implémentation complète.

---

## 6. Actions Aura disponibles

### 6.1 Créer un record

```javascript
{
    "descriptor": "aura://RecordUiController/ACTION$createRecord",
    "params": {
        "recordInput": {
            "allowSaveOnDuplicate": false,
            "apiName": "Account",
            "fields": {
                "FirstName": "John",
                "LastName": "Doe",
                "RecordTypeId": "0125Y000001zWhpQAE"
            }
        }
    }
}
```

**Query param:** `?aura.RecordUi.createRecord=1`

### 6.2 Récupérer un record

```javascript
{
    "descriptor": "aura://RecordUiController/ACTION$getRecordWithFields",
    "params": {
        "recordId": "001XXXXXXXXXXXX",
        "fields": ["Name", "Phone", "Email"]
    }
}
```

**Query param:** `?aura.RecordUi.getRecordWithFields=1`

### 6.3 Récupérer les valeurs de picklist

```javascript
{
    "descriptor": "aura://RecordUiController/ACTION$getPicklistValuesByRecordType",
    "params": {
        "objectApiName": "Account",
        "recordTypeId": "0125Y000001zWhpQAE",
        "fieldApiName": "Status__c"
    }
}
```

---

## 7. Events Lightning (côté client)

Ces events sont disponibles via `$A.get()` mais **ouvrent des modales UI** plutôt que de faire des appels API directs:

| Event | Description |
|-------|-------------|
| `e.force:createRecord` | Ouvre le formulaire de création |
| `e.force:editRecord` | Ouvre le formulaire d'édition |
| `e.force:navigateToSObject` | Navigue vers un record |
| `e.force:showToast` | Affiche une notification |

### Exemple
```javascript
const createEvent = $A.get("e.force:createRecord");
createEvent.setParams({
    entityApiName: "Account",
    recordTypeId: "0125Y000001zWhpQAE",
    defaultFieldValues: {
        FirstName: "John",
        LastName: "Doe"
    }
});
createEvent.fire();  // ← Ouvre une modale, pas un appel API
```

---

## 8. Flow de travail recommandé

```
1. Naviguer vers Salesforce Lightning
         ↓
2. Attendre le chargement du framework
         ↓
3. Intercepter une requête Aura native
         ↓
4. Capturer aura.context (fwuid) + aura.token
         ↓
5. Réutiliser pour vos propres appels API
         ↓
6. Si erreur clientOutOfSync/invalidSession → Re-capturer
```

---

## 9. Fichiers de référence

| Fichier | Description |
|---------|-------------|
| [`auth/salesforce_aura_v2.js`](../auth/salesforce_aura_v2.js) | Client Aura avec capture automatique |
| [`auth/salesforce_aura.js`](../auth/salesforce_aura.js) | Client Aura original (obsolète) |
| [`scripts/create_account_api_v2.js`](../scripts/create_account_api_v2.js) | Exemple de création de compte |
| [`inspectors/capture_aura_context.js`](../inspectors/capture_aura_context.js) | Script de diagnostic |

---

## 10. Constantes utiles

### Domaines Salesforce
```javascript
const SF_DOMAINS = [
    "indall.my.salesforce.com",
    "indall.lightning.force.com"
];
```

### Cookies d'authentification
```javascript
const SF_AUTH_COOKIES = ["sid", "sfdc_lv2", "oid"];
```

### RecordType Account (FSC)
```javascript
const ACCOUNT_RECORD_TYPE_ID = "0125Y000001zWhpQAE";
```

### Champ email custom
```javascript
// Utiliser Primary_Email__c (pas PersonEmail)
const EMAIL_FIELD = "Primary_Email__c";
```

---

## 11. Debugging

### Voir les requêtes Aura dans le navigateur

```javascript
// Dans la console du navigateur
$A.getContext()  // Voir le contexte (obfusqué en prod)
$A.get("e.force:createRecord")  // Vérifier si un event existe
```

### Intercepter avec Playwright

```javascript
page.on("request", req => {
    if (req.url().includes("/aura")) {
        console.log("Aura Request:", req.url());
        console.log("PostData:", req.postData()?.substring(0, 200));
    }
});

page.on("response", res => {
    if (res.url().includes("/aura")) {
        res.text().then(text => {
            console.log("Aura Response:", text.substring(0, 200));
        });
    }
});
```

---

## 12. Limitations connues

1. **Pas d'API publique** - L'API Aura n'est pas documentée officiellement
2. **Obfuscation** - Les méthodes changent entre versions
3. **Token expiration** - Le CSRF token expire et doit être re-capturé
4. **networkidle impossible** - Lightning fait du polling constant

---

## Historique des découvertes

| Date | Découverte |
|------|------------|
| 2026-04-01 | `ctx.fwuid` retourne `undefined` en production |
| 2026-04-01 | `aura.token = "undefined"` cause `invalidSession` |
| 2026-04-01 | Solution: intercepter les requêtes natives |
