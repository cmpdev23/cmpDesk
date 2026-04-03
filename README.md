# cmpDesk

## 🎯 Objectif

cmpDesk est une application desktop conçue pour automatiser le montage de dossiers en assurance.

L’objectif est de transformer un processus manuel, long et répétitif en un système rapide, fiable et standardisé.

L’application agit comme un **pont local sécurisé** entre :

- les systèmes externes (ex : Salesforce, assureurs)
- l'outil cmpDesk
- les scripts d’automatisation (Playwright, API)

Principes clés :

- Réduire la dépendance aux ressources humaines
- Accélérer les opérations
- Éliminer les frictions dans le workflow
- Standardiser les processus

Toutes les données sensibles (sessions, identifiants, tokens) sont **conservées localement** sur la machine de l’utilisateur et ne transitent jamais vers des services externes.

---

## 🧱 Stack technique

cmpDesk est construit avec une stack moderne orientée performance et productivité :

- **Desktop App** : Electron (Node.js)
- **Frontend UI** : React + Tailwind + shadcn/ui
- **Backend local** : Node.js (API locale)
- **Base de données locale** : SQLite
- **Automation** : Playwright (utilisé uniquement lorsque nécessaire)
- **API-first** : Priorité aux appels API plutôt qu’aux interactions UI

Philosophie technique :

- Architecture modulaire
- Séparation claire UI / logique / automation
- Réutilisabilité des fonctions
- Aucun script monolithique

---

## 🔄 Pipeline CI/CD (vue d’ensemble)

Le projet utilise une pipeline automatisée basée sur GitHub pour assurer des déploiements simples et fiables.

### Workflow global

1. **Développement local**
   - Développement et tests sur machine locale
   - Validation des scripts et flows

2. **Push sur GitHub**
   - Code versionné et centralisé

3. **GitHub Actions**
   - Build automatique de l’application
   - Packaging en `.exe` (Electron build)

4. **GitHub Releases**
   - Publication des nouvelles versions
   - Distribution des exécutables

5. **Mises à jour**
   - Les utilisateurs téléchargent ou mettent à jour l’application via les releases

Objectifs de la pipeline :

- Simplifier la distribution
- Assurer la stabilité des versions
- Automatiser le build et le packaging
- Réduire les erreurs humaines

---

## 🔐 Sécurité & données

cmpDesk est conçu avec une approche **local-first** :

- Les sessions (cookies, tokens, credentials) sont stockées localement
- Aucune donnée sensible n’est exposée dans les logs
- Aucun secret n’est hardcodé dans le code
- Les appels externes sont strictement contrôlés

L’application agit comme une **couche d’orchestration locale sécurisée**, permettant d’interagir avec des systèmes externes sans exposer les informations critiques.

---

## 🚀 Vision

cmpDesk est plus qu’un outil d’automatisation.

C’est une brique fondamentale dans la création d’un système :

- plus rapide
- plus efficace
- moins dépendant de l’humain
- difficile à reproduire

L’objectif est de construire un environnement où le conseiller se concentre sur la valeur, pendant que l’application gère l’exécution.
