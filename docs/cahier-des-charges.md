# Warden — Cahier des besoins et feuille de route produit

**Statut :** document directeur vivant  
**Version initiale :** 0.1  
**Nature :** cahier des besoins produit  
**Objectif :** guider le développement incrémental de Warden sans figer prématurément les choix techniques

---

# 1. Objet du document

Ce document définit la vision, les besoins, les principes et les grandes étapes de développement de **Warden**.

Il doit servir de référence principale pendant toute la construction du produit.

Il ne constitue volontairement **pas une spécification technique détaillée**.

Les choix suivants restent libres et pourront évoluer :

- langage ;
- framework ;
- architecture interne ;
- base de données ;
- protocole de communication ;
- technologie UI ;
- moteur d'éditeur ;
- format de stockage ;
- systèmes de plugins ;
- mécanismes de sandbox ;
- stratégies d'intégration avec les différents agents.

Le document décrit principalement :

> **ce que Warden doit permettre et pourquoi.**

Les agents de développement pourront proposer différentes manières de répondre à ces besoins.

---

# 2. Vision

Warden doit devenir **l'espace de travail permanent du développeur lorsqu'il travaille avec des agents IA**.

L'utilisateur ne doit pas dépendre de l'interface d'un agent particulier.

Aujourd'hui, il peut utiliser :

- Pi ;
- OMP ;
- OpenCode ;
- Claude Code ;
- Codex ;
- GitHub Copilot ;
- OmO ;
- Gemini ;
- ou d'autres outils.

Demain, certains de ces outils pourront disparaître ou être remplacés.

Warden doit rester.

La philosophie centrale est :

> **Les agents, harnesses, providers et modèles sont interchangeables. Le workspace appartient à l'utilisateur.**

Warden doit conserver l'environnement de travail, l'historique, les observations, les configurations, les évaluations et progressivement les habitudes du développeur indépendamment des moteurs utilisés derrière.

---

# 3. Positionnement

Warden n'a pas vocation initialement à être :

- un nouveau modèle ;
- un nouveau provider ;
- un nouveau harness ;
- un simple wrapper de Claude Code ;
- un simple frontend OpenCode ;
- un clone de VS Code ;
- un orchestrateur multi-agent complexe.

Warden doit être avant tout :

> **une couche de travail, de contrôle, d'observation et de comparaison située au-dessus de l'écosystème des coding agents.**

Le produit pourra évoluer ensuite selon les besoins réellement observés.

---

# 4. Principe de développement

Warden doit être développé **par étapes indépendantes et utilisables**.

Chaque étape doit :

1. résoudre un besoin réel ;
2. produire une version utilisable quotidiennement ;
3. être testée dans des conditions réelles ;
4. être stabilisée avant l'étape suivante ;
5. pouvoir être conservée même si la vision produit évolue.

Une étape ne doit pas être ajoutée uniquement parce qu'elle semble techniquement intéressante.

La question permanente est :

> **Est-ce que cette fonctionnalité améliore réellement mon environnement de travail ?**

---

# 5. Principe de simplicité

Warden doit éviter de reproduire le problème observé dans certains harnesses complexes :

> l'accumulation de fonctionnalités individuellement pertinentes peut produire un système lourd, coûteux et difficile à comprendre.

Chaque nouvelle couche doit donc justifier :

- son coût ;
- sa complexité ;
- son impact sur les performances ;
- son impact sur les tokens lorsqu'elle influence les agents ;
- son utilité réelle.

Lorsque cela est possible, les fonctionnalités doivent pouvoir être activées ou désactivées afin de comparer leur impact.

---

# 6. Principes produit fondamentaux

## 6.1 Pérennité

Changer de modèle ou de harness ne doit pas nécessiter de changer d'environnement de travail.

## 6.2 Indépendance

Warden ne doit pas être structurellement dépendant d'un seul agent ou provider lorsque cela peut raisonnablement être évité.

## 6.3 Transparence

L'utilisateur doit pouvoir comprendre ce que fait l'outil utilisé derrière Warden.

## 6.4 Local-first

Les données principales de l'utilisateur doivent pouvoir rester locales.

Une future synchronisation cloud ne doit pas être nécessaire au fonctionnement fondamental du produit.

## 6.5 Contrôle

L'utilisateur garde le contrôle sur :

- ses agents ;
- ses modèles ;
- ses providers ;
- ses skills ;
- ses permissions ;
- ses données ;
- ses historiques ;
- ses benchmarks.

## 6.6 Interopérabilité

Warden doit tirer parti des standards existants lorsqu'ils sont pertinents, mais ne doit pas empêcher l'intégration d'un outil qui ne les supporte pas.

## 6.7 Observabilité

Les éléments techniques importants doivent pouvoir être inspectés.

## 6.8 Mesure

Les décisions concernant les fonctionnalités agentiques doivent autant que possible être guidées par des mesures plutôt que par des intuitions.

---

# 7. Concepts principaux

Warden doit au minimum reconnaître conceptuellement les éléments suivants.

## Projet

Un repository ou workspace utilisé par l'utilisateur.

Le projet appartient à Warden et non au harness.

## Session

Une interaction de travail liée à un projet.

## Harness

Le moteur agentique utilisé pour réaliser une tâche.

Exemples :

```text
Pi
OMP
OpenCode
Claude Code
Codex
Copilot
OmO
```

## Provider

L'organisation ou infrastructure fournissant un modèle lorsque le harness permet de la choisir.

## Model

Le modèle réellement utilisé.

## Agent

Un profil de travail spécialisé.

Exemples :

```text
Developer
Inspector
Reviewer
Architect
Debugger
Frontend
```

## Skill

Un ensemble d'instructions ou de connaissances spécialisées activables.

## Tool

Une capacité d'action utilisée par l'agent.

## MCP

Une source externe de tools ou de contexte.

## Trace

L'historique technique détaillé d'une exécution.

## Benchmark

Une expérience reproductible permettant de comparer plusieurs configurations.

## Profile

Une combinaison enregistrée de préférences.

Exemple :

```text
Deep Debug

Harness: OMP
Model: Claude
Agent: Debugger
Skills:
- debugging
- typescript
```

---

# 8. Besoin : espace de travail permanent

Warden doit permettre d'organiser le travail autour des **projets**, pas autour des agents.

L'utilisateur doit pouvoir ouvrir un projet et retrouver :

- les sessions précédentes ;
- les préférences ;
- les configurations utilisées ;
- les agents ;
- les skills ;
- les modifications récentes ;
- les benchmarks associés ;
- les données d'observabilité.

Le changement de harness ne doit pas créer un nouveau monde séparé.

---

# 9. Besoin : interface unique

Warden doit fournir une interface cohérente indépendamment du moteur utilisé.

L'utilisateur doit pouvoir effectuer les opérations principales sans apprendre une interface différente pour chaque agent.

L'expérience doit rester cohérente pour :

```text
Pi
Claude Code
Codex
OpenCode
OMP
etc.
```

Lorsque certaines fonctionnalités ne sont pas disponibles avec un moteur particulier, Warden doit le signaler clairement.

---

# 10. Besoin : changement de harness

L'utilisateur doit pouvoir sélectionner le harness qu'il souhaite utiliser.

Warden doit afficher notamment :

- harness installé ;
- version ;
- disponibilité ;
- capacités connues ;
- éventuelles limitations ;
- compatibilité avec les fonctionnalités Warden.

Changer de harness ne doit pas modifier l'identité du projet.

---

# 11. Besoin : changement de provider et modèle

Lorsque le harness le permet, l'utilisateur doit pouvoir sélectionner :

```text
Harness
↓
Provider
↓
Model
```

Ces concepts doivent rester distincts.

Warden ne doit pas prétendre qu'une combinaison est possible lorsqu'elle ne l'est pas.

La compatibilité doit être explicitement indiquée.

---

# 12. Besoin : profils

L'utilisateur doit pouvoir enregistrer des configurations réutilisables.

Exemple :

```text
Quick Fix
Pi
modèle rapide
skills minimum

Deep Debug
OMP
modèle puissant
Debugger
debugging skill

Frontend
OpenCode
modèle adapté
Frontend agent
React skill
```

Un profil doit pouvoir être :

- global ;
- associé à un projet ;
- sélectionné au lancement d'une session.

---

# 13. Besoin : skills portables

Warden doit disposer de sa propre bibliothèque de skills.

L'utilisateur doit pouvoir :

- créer un skill ;
- éditer un skill ;
- activer ou désactiver un skill ;
- l'utiliser globalement ;
- le limiter à un projet ;
- voir son origine ;
- voir avec quels harnesses il est utilisable.

Warden doit chercher à rendre les skills aussi portables que possible.

Toute limitation de compatibilité doit être explicite.

---

# 14. Besoin : agents spécialisés

L'utilisateur doit pouvoir définir des profils d'agents spécialisés.

Exemples :

```text
Inspector
Reviewer
Architect
Debugger
Frontend
Security
```

Un agent peut définir notamment :

- son objectif ;
- ses instructions ;
- son modèle préféré ;
- ses skills ;
- ses permissions ;
- ses outils ;
- ses préférences de harness.

La manière exacte dont un agent est traduit vers chaque harness reste à déterminer.

---

# 15. Besoin : MCP et outils

Warden doit permettre de connaître et contrôler les outils externes disponibles.

L'utilisateur doit pouvoir visualiser :

- les MCP configurés ;
- leur état ;
- leurs outils ;
- les agents autorisés ;
- éventuellement leur impact sur le contexte.

Warden ne doit pas nécessairement implémenter lui-même MCP si le harness sait déjà le gérer.

---

# 16. Besoin : observabilité

L'une des fonctions fondamentales de Warden est de rendre les agents moins opaques.

Selon les informations réellement disponibles, Warden doit pouvoir afficher :

- modèle utilisé ;
- provider ;
- harness ;
- durée ;
- tokens ;
- coût ;
- appels modèle ;
- outils utilisés ;
- fichiers lus ;
- fichiers modifiés ;
- commandes exécutées ;
- erreurs ;
- permissions demandées ;
- événements de session ;
- progression.

---

# 17. Niveau de confiance des observations

Warden ne doit jamais présenter une estimation comme une donnée certaine.

Les informations peuvent être classées comme :

```text
Observed
Estimated
Inferred
Unavailable
```

Exemple :

```text
Input tokens       42 184       Observed
Cost               $0.21        Estimated
System prompt      unknown      Unavailable
```

---

# 18. Besoin : logs et traces

Warden doit permettre d'inspecter précisément une session.

Il doit être possible de comprendre chronologiquement :

```text
prompt
↓
model call
↓
tool
↓
model
↓
edit
↓
test
↓
result
```

Lorsque possible, Warden doit conserver :

- événements normalisés ;
- événements bruts ;
- relations parent/enfant ;
- timestamps ;
- métriques.

Les traces doivent pouvoir être filtrées.

---

# 19. Besoin : historique

Les sessions appartiennent à Warden.

L'utilisateur doit pouvoir :

- retrouver une session ;
- la consulter ;
- voir le harness utilisé ;
- voir le modèle ;
- voir son coût ;
- voir les modifications ;
- reprendre une session lorsque cela est supporté ;
- comparer une session à une autre.

---

# 20. Besoin : comparaison

Warden doit permettre de comparer plusieurs configurations.

Exemples :

```text
Pi vs OMP
```

```text
GPT avec Pi vs GPT avec OpenCode
```

```text
Claude vs GPT dans OMP
```

```text
Skill activé vs désactivé
```

La comparaison doit chercher à maintenir constantes les autres variables.

---

# 21. Besoin : laboratoire

Warden doit à terme comporter un espace dédié aux expériences.

Ce laboratoire doit permettre de définir :

- une tâche ;
- un repository ;
- un état initial ;
- plusieurs configurations ;
- plusieurs runs ;
- une limite de temps ;
- une méthode de validation.

Chaque configuration doit s'exécuter dans un environnement isolé autant que nécessaire.

---

# 22. Besoin : benchmarks reproductibles

Un benchmark fiable doit chercher à conserver :

```text
same repository state
same task
same model settings
same environment
same checker
```

pour ne modifier que la variable étudiée.

La répétition des runs doit être possible afin de limiter l'effet de la non-déterminisme.

---

# 23. Besoin : validation externe

L'agent ne doit pas être son propre juge.

Lorsque cela est possible, les benchmarks doivent utiliser :

- tests ;
- linters ;
- build ;
- checks personnalisés ;
- assertions ;
- analyse des fichiers produits.

---

# 24. Besoin : classement personnel

Warden doit pouvoir construire progressivement un classement basé sur les expériences de l'utilisateur.

Le classement ne doit pas uniquement concerner les modèles.

L'unité réellement intéressante peut être :

```text
Model
×
Harness
×
Workload
```

Un modèle peut être très bon pour :

- debugging ;

et moins bon pour :

- frontend ;
- refactoring ;
- tâches longues.

Les classements doivent donc pouvoir être filtrés.

---

# 25. Critères potentiels de classement

Warden peut mesurer :

```text
Quality
Success rate
Cost
Tokens
Speed
Reliability
Tool efficiency
User intervention
```

Le score global éventuel doit être configurable et ne jamais masquer les métriques brutes.

---

# 26. Besoin : observatoire des fonctionnalités

Lorsque Warden introduit une nouvelle fonctionnalité susceptible d'affecter le comportement des agents, celle-ci doit idéalement pouvoir être comparée à une baseline.

Exemple :

```text
Baseline
vs
+ Inspector
```

ou :

```text
Memory OFF
vs
Memory ON
```

Cela permettra de déterminer si la fonctionnalité améliore réellement :

- la réussite ;
- le coût ;
- les tokens ;
- le temps ;
- la fiabilité.

---

# 27. Principe : Every layer must justify its cost

Toute couche agentique ajoutée doit être considérée comme un coût potentiel.

Exemples :

- mémoire ;
- orchestrateur ;
- reviewer ;
- sous-agent ;
- skill ;
- MCP ;
- contexte supplémentaire ;
- tool wrapper.

Les fonctionnalités d'observabilité qui ne modifient pas le contexte des modèles ne sont évidemment pas évaluées de la même manière.

---

# 28. Besoin : environnement de code

Warden doit progressivement permettre au développeur de travailler avec son code sans quitter systématiquement l'application.

Le niveau exact d'intégration IDE reste volontairement ouvert.

Le besoin initial porte sur :

- explorer les fichiers ;
- consulter un fichier ;
- consulter les modifications ;
- visualiser les diffs ;
- identifier les fichiers touchés par l'agent ;
- ouvrir rapidement un emplacement cité dans les logs.

---

# 29. Évolution potentielle vers un IDE

Si l'expérience le justifie, Warden pourra progressivement intégrer :

- éditeur de code ;
- onglets ;
- terminal ;
- recherche ;
- diagnostics ;
- LSP ;
- Git ;
- debugging ;
- commandes ;
- extensions.

L'objectif ne doit pas être immédiatement de remplacer VS Code.

Cette évolution doit être guidée par l'usage.

---

# 30. Besoin : permissions

L'utilisateur doit pouvoir comprendre et contrôler les actions sensibles.

Selon les capacités du harness, Warden doit pouvoir afficher ou contrôler :

```text
read
write
shell
network
git
external side effect
dangerous operation
```

Une action externe importante ne doit pas devenir invisible simplement parce qu'elle est exécutée par un agent.

---

# 31. Besoin : sécurité

Warden doit clairement distinguer :

- une politique applicative ;
- une véritable isolation système.

Une permission Warden ou harness ne doit jamais être présentée comme une sandbox système si elle ne l'est pas réellement.

---

# 32. Besoin : données locales

Warden doit privilégier un stockage local pour :

- projets ;
- sessions ;
- traces ;
- configurations ;
- benchmarks ;
- rankings ;
- agents ;
- skills.

Les secrets doivent être traités séparément.

---

# 33. Besoin : portabilité

L'utilisateur doit pouvoir retrouver son environnement sur plusieurs machines.

À terme, Warden devra proposer une stratégie pour synchroniser au minimum :

- profiles ;
- agents ;
- skills ;
- préférences ;
- configurations partageables.

La solution exacte reste ouverte.

---

# 34. Besoin : import/export

Warden doit pouvoir éviter le lock-in de ses propres données.

Il doit être possible à terme d'exporter les principales données dans des formats lisibles.

---

# 35. Besoin : performances

L'interface doit rester fluide même avec :

- beaucoup de sessions ;
- de longues traces ;
- de nombreux logs ;
- de gros projets ;
- des benchmarks comportant plusieurs runs.

L'observabilité ne doit pas ralentir significativement les agents.

---

# 36. Besoin : extensibilité

L'architecture doit permettre d'ajouter de nouveaux :

```text
Harnesses
Providers
Models
Skills
Agents
MCP
Benchmark checkers
```

sans réécrire l'ensemble du produit.

Il n'est cependant pas nécessaire de créer immédiatement un SDK public complet.

---

# 37. Non-objectifs initiaux

Les éléments suivants ne sont pas des exigences des premières versions :

- créer notre propre LLM ;
- créer notre propre harness ;
- orchestration multi-agent complexe ;
- exécution distribuée ;
- cloud Warden ;
- marketplace ;
- collaboration temps réel ;
- remplacement complet de VS Code ;
- système de mémoire autonome ;
- sélection automatique parfaite du meilleur modèle ;
- infrastructure enterprise.

Ils pourront être reconsidérés plus tard.

---

# 38. Feuille de route

La roadmap doit être comprise comme une **succession de produits utilisables**, pas comme une suite de tâches techniques.

Chaque milestone doit produire quelque chose qui peut servir réellement.

---

# Étape 0 — Prototype UX

## Objectif

Valider la manière dont l'utilisateur souhaite travailler dans Warden.

## Besoins

Prototype non fonctionnel permettant d'explorer :

- workspace ;
- projets ;
- conversation ;
- harness selector ;
- model selector ;
- skills ;
- agents ;
- observabilité ;
- lab ;
- rankings ;
- éventuellement mode code.

## Validation

Cette étape est terminée lorsque :

> l'organisation générale de l'application paraît suffisamment naturelle pour commencer un vrai produit.

Aucune architecture backend ne doit être déterminée uniquement à partir de cette maquette.

---

# Étape 1 — Warden comme client quotidien

## Objectif

Pouvoir réellement utiliser Warden à la place de l'interface native d'au moins **un harness**.

## Besoins

- ouvrir un projet ;
- démarrer une session ;
- envoyer un prompt ;
- recevoir le streaming ;
- voir les tool calls essentiels ;
- répondre aux demandes de permission ;
- interrompre une session ;
- conserver un historique local ;
- connaître le harness utilisé.

Une première interface native utilisable doit exister.

## Périmètre volontairement réduit

Un seul harness peut suffire.

Un seul provider peut suffire.

Il n'est pas nécessaire d'avoir Benchmarks, Skills Warden ou IDE.

## Jalon de validation — **Daily Driver Alpha**

L'étape est validée lorsque l'utilisateur peut :

> travailler plusieurs jours sur de vrais projets uniquement via Warden pour les interactions agentiques principales, sans devoir revenir systématiquement à l'interface originale du harness.

---

# Étape 2 — Plusieurs harnesses

## Objectif

Démontrer que Warden est réellement indépendant du moteur.

## Besoins

Ajouter au moins un deuxième harness significativement différent du premier.

Warden doit conserver :

- même projet ;
- même interface ;
- même historique Warden ;
- même représentation principale des événements.

Les différences de capacités doivent être visibles.

## Jalon — **Harness Independence**

L'étape est validée lorsqu'une même tâche peut être lancée avec deux harnesses différents sans changer d'environnement de travail.

---

# Étape 3 — Providers, modèles et profils

## Objectif

Transformer Warden en environnement configurable.

## Besoins

- sélectionner provider lorsque possible ;
- sélectionner modèle ;
- afficher les compatibilités ;
- mémoriser les préférences ;
- créer des profils ;
- préférences par projet.

## Jalon — **Portable Setup**

L'utilisateur doit pouvoir passer rapidement d'une configuration :

```text
Pi + Model A
```

à :

```text
OMP + Model B
```

sans reconfigurer manuellement son environnement.

---

# Étape 4 — Observabilité

## Objectif

Faire de Warden un meilleur endroit pour comprendre les agents que leurs interfaces natives.

## Besoins

- tokens ;
- coûts ;
- durée ;
- outils ;
- fichiers ;
- erreurs ;
- timeline ;
- logs ;
- traces ;
- origine et niveau de confiance des données.

## Jalon — **Observable Agent**

Après une session, l'utilisateur doit pouvoir répondre facilement :

> Qu'est-ce qui s'est passé, combien cela a coûté et où le temps ou les tokens ont été consommés ?

---

# Étape 5 — Skills, agents et outils portables

## Objectif

Commencer à déplacer la configuration personnelle du développeur dans Warden.

## Besoins

- bibliothèque de skills ;
- activation/désactivation ;
- scope global/projet ;
- agents spécialisés ;
- profils ;
- gestion des compatibilités ;
- MCP visibles.

## Jalon — **Portable Workflow**

Un même skill ou agent Warden doit pouvoir être utilisé avec au moins deux harnesses, même si l'adaptation technique diffère.

---

# Étape 6 — Code workspace

## Objectif

Réduire les allers-retours entre Warden et l'IDE externe.

## Besoins minimum

- explorer ;
- lire ;
- diff ;
- fichiers modifiés ;
- navigation depuis les traces.

Puis, selon l'usage :

- édition ;
- terminal ;
- recherche.

## Jalon — **Integrated Workspace**

L'utilisateur doit pouvoir inspecter confortablement le travail produit par l'agent sans quitter Warden.

---

# Étape 7 — Lab

## Objectif

Permettre des comparaisons reproductibles.

## Besoins

- définir une tâche ;
- choisir plusieurs configurations ;
- environnement initial reproductible ;
- répéter les runs ;
- collecter les métriques ;
- valider les résultats ;
- comparer.

## Jalon — **Harness Bench**

L'utilisateur doit pouvoir répondre avec ses propres données à une question telle que :

> Pour cette tâche et ce modèle, Pi ou OMP fonctionne-t-il mieux ?

---

# Étape 8 — Rankings personnels

## Objectif

Transformer les expériences accumulées en connaissance utile.

## Besoins

- historique des résultats ;
- catégories de tâches ;
- classements ;
- filtres ;
- métriques ;
- comparaison Model × Harness ;
- pondérations configurables.

## Jalon — **My Benchmarks**

Warden doit pouvoir répondre :

> Quelles configurations ont historiquement le mieux fonctionné pour mes workloads ?

---

# Étape 9 — Évaluation des fonctionnalités

## Objectif

Utiliser le Lab pour améliorer Warden lui-même.

## Besoins

Permettre les comparaisons :

```text
feature OFF
vs
feature ON
```

pour les fonctions pouvant influencer un agent.

Exemples :

```text
Skill
Agent spécialisé
Memory
Reviewer
Tool optimization
```

## Jalon — **Evidence-driven Warden**

Aucune grosse couche agentique nouvelle ne devrait être activée par défaut sans données justifiant son apport.

---

# Étape 10 — IDE enrichi

## Objectif

Évaluer si Warden doit devenir l'environnement de développement principal.

Fonctionnalités candidates :

- vrai éditeur ;
- LSP ;
- Git ;
- terminal avancé ;
- diagnostics ;
- debugger ;
- splits ;
- extensions.

## Jalon — **IDE Decision**

Décider explicitement entre :

```text
Warden + IDE externe
```

et :

```text
Warden devient progressivement un IDE
```

sur la base de l'usage réel.

---

# 39. Fonctionnalités volontairement différées

Les sujets suivants pourront être explorés seulement lorsque les étapes précédentes démontrent un besoin :

```text
Memory
Automatic orchestration
Automatic harness selection
Automatic model selection
Multi-agent workflows
Remote agents
Cloud sync
Collaboration
Shared workspaces
Team analytics
Plugin marketplace
```

Aucun de ces sujets ne doit être considéré comme obligatoire aujourd'hui.

---

# 40. Règles de validation entre étapes

Avant de passer à l'étape suivante, répondre aux questions suivantes :

### Utilisabilité

Est-ce que j'utilise réellement la fonctionnalité ?

### Fiabilité

Est-elle suffisamment stable pour ne pas gêner mon travail ?

### Simplicité

L'expérience peut-elle être simplifiée avant d'ajouter quelque chose ?

### Performance

La fonctionnalité dégrade-t-elle sensiblement l'application ?

### Valeur

Est-ce que je regretterais son absence ?

### Architecture

L'étape suivante nécessite-t-elle réellement de modifier les fondations ?

Si une étape n'est pas réellement utile, elle peut être supprimée ou repensée.

---

# 41. Méthode d'itération avec les agents de développement

Pour chaque nouvelle évolution :

```text
1. Identifier un besoin réel
       ↓
2. Définir le comportement attendu
       ↓
3. Examiner les solutions existantes
       ↓
4. Proposer plusieurs implémentations
       ↓
5. Choisir la plus simple suffisante
       ↓
6. Implémenter
       ↓
7. Tester sur un vrai projet
       ↓
8. Stabiliser
       ↓
9. Documenter ce qui a été appris
       ↓
10. Décider de la suite
```

Les agents ne doivent pas extrapoler toute la roadmap lorsqu'ils travaillent sur une étape.

---

# 42. Règle pour les spécifications techniques

Ce document décrit le **besoin produit**.

Pour une étape donnée, un document technique séparé peut être créé.

Exemple :

```text
warden-product.md

specs/
  stage-1-agent-client.md
  stage-2-multi-harness.md
  stage-3-profiles.md
```

Les spécifications techniques peuvent être remplacées lorsque l'architecture évolue.

Ce document principal doit rester beaucoup plus stable.

---

# 43. Decision Log

Les décisions importantes doivent être enregistrées séparément afin d'éviter de transformer ce document en historique.

Exemple :

```text
DEC-001
Use a native desktop application.

DEC-002
Local-first storage.

DEC-003
Warden is not a harness.

DEC-004
Support multiple harnesses.

DEC-005
Every agentic layer must justify its cost.
```

Une décision peut être remplacée ultérieurement.

---

# 44. Backlog d'idées

Les nouvelles idées qui ne correspondent pas à l'étape courante doivent aller dans un backlog plutôt que dans le scope actif.

Exemple :

```text
IDE complet
Memory Watcher
Jev routing
Automatic model recommendation
Team features
Cloud sync
Mobile companion
```

Cela permet de conserver les idées sans provoquer de scope creep.

---

# 45. Critère ultime de réussite

Warden réussit si, au fil du temps :

> le développeur change de modèle, de provider ou de harness sans avoir l'impression de changer d'environnement de travail.

Et si Warden devient l'endroit naturel pour :

```text
WORK
coder avec les agents

OBSERVE
comprendre ce qu'ils font

COMPARE
mesurer leurs différences

LEARN
savoir quelles configurations fonctionnent réellement
```

---

# 46. Résumé produit

La vision actuelle peut être résumée ainsi :

```text
                         WARDEN

                 Permanent Workspace

                         │
        ┌────────────────┼────────────────┐
        │                │                │
       WORK            OBSERVE            LAB
        │                │                │
   Projects          Traces          Benchmarks
   Sessions          Costs           Comparisons
   Code              Tokens          Rankings
   Agents            Tools           Experiments
   Skills            Logs
        │                │                │
        └────────────────┼────────────────┘
                         │
                 Universal Adapter Layer
                         │
       ┌─────────┬───────┼───────┬─────────┐
       ▼         ▼       ▼       ▼         ▼
      Pi        OMP   OpenCode  Codex   Claude Code
                         │
                         ▼
              Providers / Models / Tools
```

La frontière exacte de chaque partie doit continuer à évoluer avec l'utilisation réelle.

---

# 47. Mantra de développement

Deux phrases doivent guider les décisions futures :

> **Warden is the workspace. Everything behind it is replaceable.**

et :

> **Every layer must justify its cost.**

Lorsque la vision produit est incertaine, privilégier la solution qui conserve le plus de liberté pour l'étape suivante tout en produisant immédiatement quelque chose d'utilisable.