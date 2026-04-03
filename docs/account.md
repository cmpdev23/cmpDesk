# Account — Champs Salesforce FSC

> Généré via `inspectors/inspect_account_fields.js` le 2026-04-01  
> Picklist DOM extraits via `inspectors/inspect_picklist_from_ui.js` le 2026-04-01  
> RecordTypeId: `0125Y000001zWhpQAE` (Financial Services Cloud — Individual)  
> Total champs: 264

---

## ✅ Champs requis pour la création (validés)

| Champ API               | Type      | Requis | Notes                                      |
|-------------------------|-----------|--------|--------------------------------------------|
| `FirstName`             | String    | —      | Prénom                                     |
| `LastName`              | String    | oui    | Nom de famille                             |
| `RecordTypeId`          | Reference | —      | FSC Individual: `0125Y000001zWhpQAE`       |
| `Primary_Email__c`      | Email     | non    | Email principal                            |
| `Primary_Email_Type__c` | Picklist  | non    | Type email — ⚠️ valeurs non encore capturées (voir §Picklist) |
| `Phone`                 | Phone     | non    | 10 chiffres numériques (ex: `5141234567`)  |
| `Primary_Phone_Type__c` | Picklist  | non    | Type phone — ⚠️ valeurs non encore capturées (voir §Picklist) |

---

## 📧 Tous les champs Email détectés

| Champ API                        | Type     | Requis | Notes                                        |
|----------------------------------|----------|--------|----------------------------------------------|
| `Primary_Email__c`               | Email    | non    | ✅ Champ principal à utiliser                |
| `Primary_Email_Type__c`          | Picklist | non    | ✅ Type de l'email principal (`__c`)         |
| `Primary_Email_Type__pc`         | Picklist | non    | Variante Person Account (`__pc`)             |
| `PersonEmail`                    | Email    | non    | Email standard SF Person Account             |
| `PersonEmailBouncedDate`         | DateTime | non    | Date bounce email                            |
| `PersonEmailBouncedReason`       | String   | non    | Raison bounce email                          |
| `Last_Email_Date__c`             | Date     | non    | Dernière date d'email                        |
| `Last_Email_Or_Note_Date__c`     | Date     | non    | Dernière date email ou note                  |
| `FinServ__EmailVerified__pc`     | Boolean  | **oui**| ⚠️ Requis selon metadata — possiblement géré automatiquement |

---

## 📞 Tous les champs Phone détectés

| Champ API                        | Type     | Requis | Notes                                        |
|----------------------------------|----------|--------|----------------------------------------------|
| `Phone`                          | Phone    | non    | ✅ Champ phone principal (10 chiffres)       |
| `Primary_Phone_Type__c`          | Picklist | non    | ✅ Type du phone principal (`__c`)           |
| `Primary_Phone_Type__pc`         | Picklist | non    | Variante Person Account (`__pc`)             |
| `Other_Phone__c`                 | Phone    | non    | Téléphone secondaire                         |
| `PrimaryPhoneLastSeven__c`       | Phone    | non    | 7 derniers chiffres (calculé?)               |
| `FinServ__HomePhoneVerified__pc` | Boolean  | **oui**| ⚠️ Requis selon metadata — possiblement géré automatiquement |

---

## 🏷️ Valeurs Picklist confirmées (extraites du DOM — 2026-04-01)

> ⚠️ **Bug connu**: Lightning réutilise un seul listbox DOM global — les options s'accumulent entre
> les ouvertures successives. Les valeurs sont reconstituées par **delta entre deux ouvertures consécutives**.
> Les champs `Primary_Phone_Type__c` et `Primary_Email_Type__c` n'ont pas retourné de nouvelles valeurs
> lors de l'extraction (delta = 0). Voir `§Picklist manquantes`.

### `Type` (Account Type — standard SF)

| value | label |
|-------|-------|
| *(vide)* | - Aucun - |
| `IA Client` | IA Client |
| `Non-IA Client` | Autre Client |
| `Prospect` | Prospect |
| `Contact` | Contact |

### `Rating` (Niveau d'intérêt)

| value | label |
|-------|-------|
| *(vide)* | - Aucun - |
| `Hot` | Élevé |
| `Warm` | Moyen |
| `Cold` | Faible |

### `CustomerPriority__c` (Catégorie)

| value | label |
|-------|-------|
| *(vide)* | - Aucun - |
| `Platinum` | Platine |
| `Gold` | Or |
| `Silver` | Argent |
| `Bronze` | Bronze |

### `Salutation` / `PersonSalutation` (Civilité)

| value | label |
|-------|-------|
| *(vide)* | - Aucun - |
| `M` | M. |
| `MISS` | Mlle. |
| `MRS` | Mme. |
| `DR` | Dr. |
| `ME` | Me. |

### `PersonMaritalStatus` / `MaritalStatus__pc` (État civil)

| value | label |
|-------|-------|
| *(vide)* | - Aucun - |
| `SIN` | Célibataire |
| `LCL` | Conjoint(e) de fait |
| `DIV` | Divorcé(e) |
| `MAR` | Marié(e) |
| `SEP` | Séparé(e) |
| `WID` | Veuf(ve) |
| `CIV` | Union civile |

### `HomeOwnershipStatus__pc` (Habitation)

| value | label |
|-------|-------|
| *(vide)* | - Aucun - |
| `Other` | Autre |
| *(+ options héritées)* | |

---

## ⚠️ Picklist manquantes — extraction incomplète

Les champs suivants ont retourné **0 nouvelles options** lors de l'extraction DOM (delta = 0).
Leur listbox partagé avait déjà accumulé 30 options des champs précédents.

| Champ API | Label UI | Statut |
|-----------|----------|--------|
| `Primary_Phone_Type__c` | Type du Téléphone Principal | ❌ Non capturé |
| `Primary_Email_Type__c` | Type du E-mail Principal | ❌ Non capturé |
| `PreferredLanguage__pc` | Langue de préférence | ❌ Non capturé |
| `Gender__pc` | Genre | ❌ Non capturé |
| `FinServ__BirthCountry__pc` | Pays de naissance | ❌ Non capturé |

**Prochaine étape**: Adapter `inspectors/inspect_picklist_from_ui.js` pour isoler chaque dropdown
individuellement (fermer/réinitialiser le listbox entre chaque ouverture, ou cibler directement
les options visibles dans le dropdown courant avec `waitForSelector` + `querySelectorAll` instantané).

---

## 🏷️ Champs Type (Picklist) — tous

| Champ API                     | Type     | Requis | Notes                              |
|-------------------------------|----------|--------|------------------------------------|
| `Primary_Email_Type__c`       | Picklist | non    | Type email principal               |
| `Primary_Email_Type__pc`      | Picklist | non    | Idem — Person Account variant      |
| `Primary_Phone_Type__c`       | Picklist | non    | Type phone principal               |
| `Primary_Phone_Type__pc`      | Picklist | non    | Idem — Person Account variant      |
| `Primary_Address_Type__c`     | Picklist | non    | Type adresse principale            |
| `FinServ__IndividualType__c`  | Picklist | non    | Type individu FSC                  |
| `FinServ__IndividualType__pc` | Picklist | non    | Idem — Person Account variant      |
| `Preferred_Meeting_Type__pc`  | Picklist | non    | Type réunion préférée              |
| `Billing_Unit_Type__c`        | Picklist | non    | Type unité de facturation          |
| `Type`                        | Picklist | non    | Type Account standard SF           |

---

## ⚠️ Points d'attention

1. **`FinServ__EmailVerified__pc`** (Boolean, requis: true) — probablement géré automatiquement par SF,
   à tester si une validation rule bloque la création sans ce champ.

2. **`FinServ__HomePhoneVerified__pc`** (Boolean, requis: true) — même situation.

3. **Valeurs picklist Phone/Email Type** — non retournées par `getObjectInfo`, non accessibles via
   `getPicklistValues` (404), et non capturées via DOM (cumulative listbox bug). À isoler via
   un script ciblant directement ces dropdowns avec reset entre chaque.

4. **`__c` vs `__pc`** — préférer les variantes `__c` pour les appels API directs.
   Les `__pc` sont des champs miroir sur le PersonContact sous-jacent.

5. **Bug DOM extracteur**: Le `lightning-base-combobox-item` dans un listbox SF partagé accumule
   les options de tous les dropdowns ouverts. Stratégie correcte : capturer `innerHTML` du dropdown
   *immédiatement* après ouverture via `page.evaluate` synchrone.

---

## 📁 Rapports générés

| Fichier | Contenu |
|---------|---------|
| `inspectors/reports/account_fields.json` | Tous les 264 champs (métadonnées Aura) |
| `inspectors/reports/picklist_values.json` | Tentative Aura API — retours vides/404 |
| `inspectors/reports/picklist_from_ui.json` | Extraction DOM — 18 dropdowns, valeurs cumulées |
| `inspectors/reports/form_loaded.png` | Screenshot du formulaire Account au moment de l'extraction |

---

## 🔗 Références

- Inspector champs: [`inspectors/inspect_account_fields.js`](../inspectors/inspect_account_fields.js)
- Inspector picklist API: [`inspectors/inspect_picklist_values.js`](../inspectors/inspect_picklist_values.js)
- Inspector picklist DOM: [`inspectors/inspect_picklist_from_ui.js`](../inspectors/inspect_picklist_from_ui.js)
- Seeds: [`scripts/seeds/account.js`](../scripts/seeds/account.js)
- RecordTypeId source: [`auth/salesforce_session.js`](../auth/salesforce_session.js)
