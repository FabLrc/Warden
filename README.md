# Warden

> Warden is the workspace. Everything behind it is replaceable.

Espace de travail desktop pour coder avec des agents IA indépendamment du harness (OpenCode, Claude Code, Codex, Pi, OMP…).

- Vision et besoins : [`docs/cahier-des-charges.md`](docs/cahier-des-charges.md)
- Étape en cours : [`docs/specs/stage-0-prototype-ux.md`](docs/specs/stage-0-prototype-ux.md) — prototype UX **non fonctionnel** (données fictives)
- Décisions : [`docs/decisions.md`](docs/decisions.md)

## Prérequis (macOS)

- Node.js ≥ 20.19
- Rust stable (`rustup`) et Xcode Command Line Tools — voir les [prérequis Tauri](https://v2.tauri.app/start/prerequisites/)

## Commandes

```sh
npm install
npm run tauri dev     # application desktop
npm run dev           # frontend seul dans le navigateur (http://localhost:1420)
npm run build         # typecheck + build frontend
npm run lint          # Biome
npm run tauri build   # bundle .app / .dmg
```

## Structure

```text
src-tauri/            shell Tauri 2 (aucune commande Rust à l'étape 0)
src/
  app/                shell : rail, sidebar contextuelle, routes
  screens/            work · observe · lab · settings · code
  components/ui/      composants shadcn/ui (générés)
  components/warden/  composants partagés (badges de confiance, diff, sélecteur de config…)
  mock/               types et fixtures de la maquette — jetables, pas le schéma de l'étape 1
  lib/                formatage, libellés, liens
```
