# Étape 0 — Prototype UX : plan de développement

**Référence produit :** `docs/cahier-des-charges.md` (§38, Étape 0)
**Statut :** proposé
**Date :** 2026-10-07

---

## 1. Objectif

Produire une application desktop **navigable mais non fonctionnelle** qui permet de valider l'organisation générale de Warden avant de construire le vrai produit.

Critère de sortie (CDC) :

> l'organisation générale de l'application paraît suffisamment naturelle pour commencer un vrai produit.

Contrainte (CDC) : aucune architecture backend ne doit être déduite de cette maquette.

---

## 2. Périmètre

### Inclus

Écrans explorant chacun des thèmes listés par le CDC :

- workspace et projets ;
- conversation (session) ;
- sélecteur de harness ;
- sélecteur provider / modèle ;
- profils ;
- skills ;
- agents ;
- MCP et outils (lecture seule) ;
- observabilité (métriques, timeline, traces, niveaux de confiance) ;
- lab ;
- rankings ;
- mode code (optionnel, en dernier).

### Exclus

- lancement réel d'un harness, ACP, processus enfants ;
- persistance (aucune écriture disque, aucun SQLite) ;
- commandes Tauri personnalisées côté Rust ;
- authentification, secrets, réseau ;
- Linux / Windows ;
- tests automatisés au-delà du typecheck et du lint.

Toutes les données proviennent de fixtures TypeScript statiques.

---

## 3. Stack

| Élément | Choix | Raison |
|---|---|---|
| Shell desktop | Tauri 2.12.x (dernière stable) | Choix utilisateur ; réutilisé tel quel à l'Étape 1 |
| Frontend | React + TypeScript + Vite | Écosystème le plus large (markdown, diff, futur éditeur) |
| UI | Tailwind CSS + shadcn/ui + lucide | Itération rapide sur la maquette ; composants copiés, donc remplaçables |
| Routing | React Router (mode bibliothèque) | Les URL rendent chaque écran directement accessible pendant les revues |
| Coloration code / diff | Shiki | Uniquement pour le mode code, si on le réalise |
| Lint / format | Biome | Un seul outil, configuration minimale |
| Plateforme | macOS uniquement | Pas de CI multi-plateforme |

Côté Rust : template généré par `create-tauri-app`, sans commande ni plugin supplémentaire.

---

## 4. Architecture de la maquette

```text
src-tauri/            template Tauri, inchangé
src/
  app/                shell : layout, navigation, routes
  screens/            un dossier par zone (work, observe, lab, settings, code)
  components/         composants partagés (badges de confiance, cartes tool call…)
  mock/
    types.ts          types des concepts du CDC §7 (jetables)
    fixtures/         données de démonstration
    replay.ts         lecture temporisée d'une session scriptée
```

### Règle sur les types mock

`src/mock/types.ts` décrit Project, Session, Harness, Provider, Model, Agent, Skill, Tool, MCP, TraceEvent, Benchmark, Profile et Observation, **uniquement pour alimenter l'interface**. Ces types ne constituent pas le schéma de l'Étape 1 et ne doivent pas y être repris sans être réexaminés.

### Organisation de l'interface proposée

Hypothèse à valider (reprend les trois piliers du CDC §46) :

```text
┌────┬──────────────┬───────────────────────────────┬──────────────┐
│Rail│ Projet       │ Zone principale               │ Inspecteur   │
│    │ - sessions   │ conversation / trace / lab…   │ (repliable)  │
│Work│ - profils    │                               │ métriques,   │
│Obs.│ - skills     │                               │ détails      │
│Lab │ - agents     │                               │ d'événement  │
│ ⚙  │              │ [composer : profil ▾ harness ▾ modèle ▾]     │
└────┴──────────────┴───────────────────────────────┴──────────────┘
```

Une organisation alternative (onglets par session, palette de commandes) pourra être testée pendant le lot 6 si celle-ci paraît peu naturelle.

---

## 5. Données de démonstration

Un seul jeu de fixtures, cohérent d'un écran à l'autre :

- 3 projets, dont un avec un long historique ;
- harnesses : OpenCode (principal), Claude Code, Codex, Pi, OMP, avec des capacités **volontairement différentes** pour tester l'affichage des incompatibilités (CDC §9, §10, §11) ;
- combinaisons harness → provider → modèle, dont certaines sont invalides et doivent apparaître comme telles ;
- profils `Quick Fix`, `Deep Debug`, `Frontend` (CDC §12) ;
- 1 session scriptée rejouée en streaming : prompt → réflexion → lecture de fichier → demande de permission shell → édition → test → résultat ;
- métriques portant chacune un niveau de confiance `Observed` / `Estimated` / `Inferred` / `Unavailable` (CDC §17). Les données qu'ACP n'expose pas (tokens, coût sous OpenCode, par exemple) sont marquées `Unavailable` afin d'éprouver honnêtement l'interface ;
- 1 benchmark de 2 configurations × 3 runs avec un checker « tests » ;
- un historique de rankings filtrable par Model × Harness × Workload.

---

## 6. Lots

Chaque lot se termine par une build `tauri dev` qui fonctionne et une revue rapide de l'écran.

### Lot 0 — Socle

- `create-tauri-app` (React + TS + Vite) ; vérifier que Tauri est en 2.12.x ;
- Tailwind, shadcn/ui, Biome, React Router ;
- shell : rail, sidebar, zone principale, inspecteur repliable, thème sombre ;
- `mock/types.ts` et une première version des fixtures.

**Fait quand :** l'app s'ouvre sur macOS et on navigue entre des écrans vides.

### Lot 1 — Work : projets et conversation

- liste des projets, accueil d'un projet (sessions précédentes, préférences, modifications récentes, benchmarks associés — CDC §8) ;
- vue conversation : rejeu en streaming, cartes de tool calls repliables, dialogue de permission (autoriser une fois / toujours / refuser), bouton d'interruption ;
- composer avec sélecteurs profil / harness / modèle ;
- badge indiquant le harness de la session ;
- message explicite lorsqu'une fonctionnalité n'est pas disponible avec le harness choisi.

**Fait quand :** le parcours P1 à P3 (§7) est réalisable.

### Lot 2 — Configuration

- page Harnesses : installé, version, disponibilité, capacités, limitations, compatibilité Warden (CDC §10) ;
- sélecteur provider / modèle en cascade, avec les combinaisons incompatibles grisées et leur raison (CDC §11) ;
- profils : global, par projet, choisi au lancement (CDC §12) ;
- bibliothèque de skills : liste, éditeur factice, activation, scope, origine, compatibilité par harness (CDC §13) ;
- agents : objectif, instructions, modèle préféré, skills, permissions, outils (CDC §14) ;
- MCP : liste, état, outils, agents autorisés (CDC §15).

### Lot 3 — Observe

- panneau de métriques de session avec badges de confiance ;
- timeline chronologique prompt → model call → tool → edit → test → result, avec relations parent/enfant (CDC §18) ;
- filtres (type d'événement, outil, erreurs) ;
- bascule entre vue normalisée et événement brut ;
- vue historique : recherche dans les sessions et comparaison de deux sessions côte à côte (CDC §19).

**Fait quand :** le parcours P4 est réalisable.

### Lot 4 — Lab et rankings

- définition d'une expérience : tâche, repository, état initial, configurations, nombre de runs, limite de temps, checker (CDC §21) ;
- résultats : tableau configuration × métriques brutes, variance entre runs ;
- rankings : filtres Model / Harness / Workload, pondérations réglables, métriques brutes toujours visibles (CDC §24, §25) ;
- vue « feature OFF vs ON » sur un exemple (CDC §26).

### Lot 5 — Mode code (optionnel)

- arborescence, lecture d'un fichier, diff, liste des fichiers touchés par l'agent ;
- clic sur un événement de trace → ouverture du fichier ou du diff concerné (CDC §28).

Lot à faire seulement si les lots 1 à 4 ont laissé ouverte la question de la place du code dans l'interface.

### Lot 6 — Revue et décision

- dérouler les parcours du §7 ;
- noter les frictions dans `docs/specs/stage-0-findings.md` ;
- itérer sur l'organisation (une ou deux variantes au maximum) ;
- enregistrer les décisions dans `docs/decisions.md` ;
- go / no-go pour l'Étape 1, puis rédiger `docs/specs/stage-1-agent-client.md`.

---

## 7. Parcours de validation

L'étape est validée lorsque chacun de ces parcours se fait sans hésitation sur l'endroit où aller :

| # | Parcours |
|---|---|
| P1 | Ouvrir un projet et reprendre la dernière session |
| P2 | Lancer une session avec le profil `Deep Debug` |
| P3 | Répondre à une demande de permission, puis interrompre la session |
| P4 | Après une session : dire ce qui s'est passé, combien cela a coûté et où sont partis le temps et les tokens |
| P5 | Changer de harness et repérer une fonctionnalité non supportée |
| P6 | Choisir une combinaison provider / modèle invalide et comprendre pourquoi elle l'est |
| P7 | Activer un skill pour un seul projet et voir avec quels harnesses il est compatible |
| P8 | Définir une comparaison OpenCode vs Claude Code sur une même tâche |
| P9 | Trouver la configuration historiquement la meilleure pour du debugging |
| P10 | (si lot 5) Passer d'un événement de trace au diff correspondant |

---

## 8. Risques

| Risque | Mitigation |
|---|---|
| Maquette trop soignée, devenant un coût irrécupérable | Composants shadcn bruts, pas de travail de finition visuelle |
| Les types mock deviennent implicitement le schéma backend | Règle du §4, réexamen explicite à l'Étape 1 |
| Maquette trop optimiste sur les données disponibles | Fixtures marquant `Unavailable` ce qu'ACP n'expose pas |
| Glissement vers un IDE | Lot 5 optionnel, limité à la lecture |

---

## 9. Préparation de l'Étape 1 (hors périmètre)

Orientations déjà retenues, à confirmer dans la spec de l'Étape 1 (voir `docs/decisions.md`) :

- premier harness : OpenCode (`opencode acp`, support ACP natif) ;
- intégration ACP d'abord, avec conservation des événements bruts ;
- le shell Tauri et le frontend React sont conservés ; les écrans de la maquette sont repris ou réécrits selon les conclusions de la revue.
