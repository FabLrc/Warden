# Warden — Decision Log

Décisions importantes, cf. CDC §43. Une décision peut être remplacée par une décision ultérieure qui la cite.

---

## DEC-001 — Application desktop native avec Tauri 2

**Date :** 2026-10-07 · **Statut :** acceptée

Application desktop basée sur Tauri 2 (dernière stable : 2.12.x), avec un backend Rust et une interface web.

## DEC-002 — Stockage local-first

**Date :** 2026-10-07 · **Statut :** acceptée

Projets, sessions, traces, configurations et benchmarks sont stockés localement (CDC §6.4, §32). Le format reste à définir à l'Étape 1.

## DEC-003 — Warden n'est pas un harness

**Date :** 2026-10-07 · **Statut :** acceptée

Warden pilote des harnesses existants et n'implémente pas sa propre boucle agentique (CDC §3, §37).

## DEC-004 — Support de plusieurs harnesses

**Date :** 2026-10-07 · **Statut :** acceptée

L'architecture ne doit pas dépendre structurellement d'un seul harness (CDC §6.2).

## DEC-005 — Chaque couche doit justifier son coût

**Date :** 2026-10-07 · **Statut :** acceptée

CDC §27.

## DEC-006 — Frontend React + TypeScript + Vite

**Date :** 2026-10-07 · **Statut :** acceptée

Choisi pour l'étendue de son écosystème : rendu markdown, diff, virtualisation, futur éditeur.

## DEC-007 — macOS uniquement pour les premières étapes

**Date :** 2026-10-07 · **Statut :** acceptée

On évite tout code spécifique à macOS lorsque ce n'est pas nécessaire, afin de garder ouverte l'option Linux / Windows.

## DEC-008 — Première étape réalisée : prototype UX (Étape 0)

**Date :** 2026-10-07 · **Statut :** acceptée

Plan : `docs/specs/stage-0-prototype-ux.md`.

## DEC-009 — Intégration ACP d'abord, OpenCode comme premier harness

**Date :** 2026-10-07 · **Statut :** proposée, à confirmer à l'Étape 1

Les harnesses seront intégrés en priorité via l'Agent Client Protocol (ACP). Premier harness : OpenCode (support ACP natif). Claude Code, Codex et Pi passent par des adaptateurs ACP.

Conséquence connue : ACP expose peu de données d'observabilité (tokens, coût). Les événements bruts devront être conservés dès l'Étape 1, et un complément spécifique à chaque harness sera probablement nécessaire à l'Étape 4.

## DEC-010 — Identité visuelle « Warden » sombre et cyan

**Date :** 2026-10-07 · **Statut :** acceptée (à revoir lors de la revue de l'Étape 0)

Thème sombre unique inspiré du Warden de Minecraft : fond bleu-vert très sombre, cyan « sculk » réservé aux accents, à l'état actif et au focus, beige « os » en touche secondaire. Le texte courant reste neutre (pas de cyan) pour la lisibilité ; toutes les paires texte/fond atteignent au moins le niveau WCAG AA (≥ 5,3:1). Palette définie dans `src/index.css`.

## DEC-011 — Interface en français, termes du CDC en anglais

**Date :** 2026-10-07 · **Statut :** acceptée (à revoir lors de la revue de l'Étape 0)

Libellés en français ; les concepts du CDC §7 (Harness, Provider, Session, Skills, Lab, Rankings, Observed/Estimated…) restent en anglais pour coller au vocabulaire des outils.

## DEC-012 — Socle frontend de l'Étape 0

**Date :** 2026-10-07 · **Statut :** acceptée

- Tailwind CSS 4 + shadcn/ui (style radix-nova) : composants copiés dans `src/components/ui`, donc remplaçables.
- React Router 7 avec hash router : les liens profonds survivent au rechargement dans l'app packagée, sans réécriture côté serveur. React Router 8 exige Node ≥ 22.22, d'où le maintien en version 7 tant que l'environnement est en Node 20.
- Biome pour le lint et le formatage ; Shiki pour la coloration du mode code.
- Aucune commande Rust : le plugin `opener` et la commande d'exemple du template ont été retirés.
