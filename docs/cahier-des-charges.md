# Warden — Cahier des charges

**Version :** 0.1  
**Statut :** Document de cadrage initial  
**Nom du projet :** Warden  
**Nom alternatif :** Warden Harness  
**Type :** Harness agentique de développement basé sur Pi  
**Interface initiale :** TUI  
**Licence :** À définir  

---

# 1. Présentation du projet

## 1.1 Contexte

Les harness agentiques de développement actuels permettent d'obtenir des performances élevées grâce à l'utilisation de sous-agents, de skills, de modèles spécialisés, de MCP et de workflows complexes.

Cependant, cette sophistication entraîne plusieurs problèmes :

- consommation importante de tokens ;
- multiplication parfois inutile des appels aux modèles ;
- manque de visibilité sur ce que fait réellement l'orchestrateur ;
- difficulté à comprendre pourquoi un agent ou un modèle a été choisi ;
- contexte chargé inutilement dès le début des sessions ;
- difficulté à mesurer la pertinence des sous-agents et outils utilisés ;
- workflows parfois opaques ;
- difficulté à reprendre une session longue après interruption ;
- mémoire projet souvent rudimentaire ou difficile à auditer ;
- configuration difficile à transporter entre plusieurs machines.

Warden vise à proposer une approche différente.

> **Warden makes agentic coding observable and cost-aware.**

Warden doit permettre à l'utilisateur de voir et comprendre :

- qui travaille ;
- sur quelle tâche ;
- pourquoi cet agent a été appelé ;
- quel modèle est utilisé ;
- quelle catégorie a été sélectionnée ;
- quels skills sont chargés ;
- quel contexte a été transmis ;
- quels outils sont utilisés ;
- combien de tokens sont consommés ;
- quel est le coût estimé ;
- combien de contexte a été économisé ;
- quelles connaissances Warden possède sur le projet ;
- quelles nouvelles connaissances il apprend.

L'objectif n'est pas de maximiser le nombre d'agents ou la complexité de l'orchestration.

L'objectif est d'utiliser **le minimum d'orchestration nécessaire pour obtenir un résultat fiable**.

---

# 2. Vision

Warden est une couche d'orchestration construite autour de Pi.

Pi fournit le runtime agentique fondamental.

Warden apporte principalement :

- orchestration ;
- sous-agents spécialisés ;
- catégories de tâches ;
- sélection et configuration des modèles ;
- gestion du contexte ;
- permissions ;
- mémoire projet ;
- skills lazy-loaded ;
- intégration MCP ;
- optimisation des outils ;
- observabilité ;
- persistance des sessions ;
- reprise après interruption ;
- apprentissage contrôlé ;
- interface utilisateur ;
- outils de diagnostic et de développement.

Architecture conceptuelle :

```text
                        USER
                          │
                          ▼
                 ┌─────────────────┐
                 │     WARDEN      │
                 │  Orchestrator   │
                 └────────┬────────┘
                          │
                Decision / Routing
                          │
           ┌──────────────┼──────────────┐
           │              │              │
           ▼              ▼              ▼
       Inspector       Navigator       Builder
           │              │              │
           └──────────────┼──────────────┘
                          │
                          ▼
                       Reviewer
                          │
                          ▼
                     Verification
```

Les fonctionnalités transversales sont fournies par le runtime Warden :

```text
┌──────────────────────────────────────────────────┐
│                  WARDEN RUNTIME                  │
│                                                  │
│ Skills │ MCP │ Memory │ Permissions │ Tool Proxy │
│                                                  │
│ Events │ Traces │ Sessions │ Context │ Metrics   │
└──────────────────────────────────────────────────┘
```

---

# 3. Principes fondamentaux

Warden doit respecter les principes suivants.

## 3.1 Observabilité

Une décision importante prise par le système doit pouvoir être comprise après coup.

Warden doit permettre de répondre à des questions telles que :

- Pourquoi cet agent a-t-il été appelé ?
- Pourquoi ce modèle a-t-il été choisi ?
- Pourquoi ce skill a-t-il été chargé ?
- Quel contexte a été transmis à cet agent ?
- Pourquoi cette mémoire a-t-elle été rappelée ?
- Quel outil a consommé le plus de contexte ?
- Quelle étape a coûté le plus cher ?
- Pourquoi la tâche a-t-elle échoué ?

---

## 3.2 Orchestration minimale

Warden doit privilégier le workflow le plus simple capable de résoudre correctement une tâche.

Exemple :

```text
Renommer une variable

Builder
   │
   ▼
Verification
```

et non :

```text
Inspector
   ↓
Navigator
   ↓
Planner
   ↓
Builder
   ↓
Reviewer #1
   ↓
Reviewer #2
```

La sophistication de l'orchestration doit être proportionnelle à la complexité et au risque de la tâche.

---

## 3.3 Context efficiency

Le contexte est considéré comme une ressource.

Warden doit chercher à éviter :

- l'héritage inutile de conversations longues ;
- le chargement systématique de tous les skills ;
- le chargement complet de toute la mémoire ;
- les sorties d'outils excessivement volumineuses ;
- les répétitions d'informations déjà connues.

---

## 3.4 Configuration explicite

Les comportements importants doivent pouvoir être configurés.

La configuration doit être modifiable :

- depuis les fichiers ;
- depuis l'interface Warden.

L'interface agit comme un éditeur de la configuration et non comme une source de vérité séparée.

---

## 3.5 Auditabilité

Agents, mémoire, permissions, outils et décisions doivent pouvoir être inspectés.

Warden ne doit pas devenir une boîte noire.

---

## 3.6 Portabilité

Une configuration Warden doit pouvoir être utilisée sur plusieurs machines.

Le comportement d'un projet doit pouvoir être reproduit après clonage du dépôt.

---

## 3.7 Sécurité

Les permissions des agents doivent être explicites.

Une tâche agentique ne doit pas automatiquement donner accès à toutes les capacités disponibles sur la machine.

---

# 4. Architecture générale

Warden doit être conçu de manière modulaire.

```text
warden/
│
├── core/
│   ├── orchestration
│   ├── task-engine
│   ├── categories
│   ├── routing
│   └── recovery
│
├── runtime/
│   ├── agents
│   ├── models
│   ├── skills
│   ├── mcp
│   ├── tools
│   ├── permissions
│   └── memory
│
├── observability/
│   ├── events
│   ├── tracing
│   ├── token-accounting
│   ├── context-inspector
│   └── metrics
│
├── persistence/
│   ├── sessions
│   ├── checkpoints
│   └── migrations
│
├── ui/
│   └── tui
│
└── cli/
```

À terme :

```text
@warden/core
@warden/runtime
@warden/tui
@warden/cli
@warden/desktop
```

La logique métier ne doit pas dépendre de la TUI.

---

# 5. Agents

## 5.1 Philosophie

Le roster d'agents doit volontairement rester réduit.

Un petit nombre d'agents est :

- plus simple à comprendre ;
- plus simple à maintenir ;
- plus simple à auditer ;
- moins susceptible d'entraîner des délégations inutiles.

---

# 6. Warden — Orchestrateur

Warden est l'agent principal.

Il reçoit les demandes utilisateur et décide du workflow nécessaire.

Ses responsabilités incluent notamment :

- comprendre la demande ;
- déterminer la complexité de la tâche ;
- créer ou adapter le DAG ;
- choisir les agents nécessaires ;
- sélectionner les catégories ;
- charger les skills pertinents ;
- transmettre uniquement le contexte nécessaire ;
- superviser la progression ;
- analyser les erreurs ;
- déclencher les validations appropriées ;
- restituer le résultat final.

Warden ne doit pas systématiquement déléguer.

Une tâche suffisamment simple peut être exécutée directement selon le workflow défini.

---

# 7. Inspector

Inspector est spécialisé dans l'exploration du projet local.

Ses responsabilités comprennent :

- recherche de fichiers ;
- recherche de symboles ;
- compréhension d'une architecture existante ;
- analyse de dépendances internes ;
- identification des portions pertinentes d'une codebase ;
- collecte du contexte nécessaire aux autres agents.

Inspector est principalement **read-only**.

Il ne doit normalement pas modifier le code.

---

# 8. Navigator

Navigator est spécialisé dans les ressources externes.

Il peut notamment consulter :

- documentation officielle ;
- documentation de frameworks ;
- dépôts GitHub ;
- exemples d'implémentation ;
- API externes ;
- ressources web autorisées ;
- MCP orientés recherche.

Navigator est principalement **read-only**.

---

# 9. Builder

Builder est responsable des modifications du projet.

Il peut notamment :

- écrire du code ;
- modifier des fichiers ;
- créer des fichiers ;
- appliquer un refactoring ;
- corriger un bug ;
- implémenter une fonctionnalité ;
- exécuter les validations autorisées.

Une seule instance de Builder disposant des droits d'écriture doit travailler simultanément dans les premières versions de Warden.

Les modifications parallèles via Git worktrees ne font pas partie du MVP.

---

# 10. Reviewer

Reviewer est chargé de vérifier le travail produit.

Il peut effectuer :

- contrôle de conformité à la demande ;
- revue de qualité ;
- vérification des conventions ;
- analyse des modifications ;
- vérification des tests ;
- identification de régressions potentielles.

Reviewer est normalement **read-only**.

---

# 11. Agents et catégories

Un agent et une catégorie sont deux concepts différents.

## Agent

Un agent répond à :

> Qui travaille ?

Exemples :

- Inspector ;
- Navigator ;
- Builder ;
- Reviewer.

## Catégorie

Une catégorie répond à :

> Quel type de travail est effectué ?

Exemples potentiels :

```text
quick
research
debug
implementation
architecture
deep-analysis
review
documentation
```

Un même agent peut être exécuté avec différentes catégories.

Exemple :

```text
Builder + quick
Builder + implementation
Builder + deep-debug
```

---

# 12. Configuration des catégories

Les catégories doivent être configurables depuis la TUI.

Une catégorie peut définir notamment :

```yaml
name: implementation

model:
  provider: anthropic
  id: example-model

reasoning: medium

context:
  maxTokens: 64000

validation:
  strategy: dynamic

fallback:
  enabled: true
```

Les champs exacts évolueront avec les capacités de Pi et des providers.

L'utilisateur doit pouvoir :

- créer une catégorie ;
- modifier une catégorie ;
- supprimer une catégorie ;
- changer son modèle ;
- modifier son niveau de reasoning ;
- définir des paramètres de contexte ;
- définir sa stratégie de validation ;
- définir éventuellement un fallback.

---

# 13. Model Registry

Warden doit disposer d'une abstraction indépendante des providers.

```text
Category
   ↓
Model Registry
   ↓
Provider Adapter
   ↓
Pi
```

Le registre doit connaître lorsque possible :

- provider ;
- identifiant du modèle ;
- capacités ;
- contexte maximum ;
- support du reasoning ;
- support vision ;
- coût input ;
- coût output ;
- coût cached input ;
- autres métriques pertinentes.

Les prix doivent pouvoir être mis à jour indépendamment du cœur de Warden.

Les coûts affichés par Warden doivent être considérés comme **estimés** lorsque le provider ne fournit pas directement le coût facturé.

---

# 14. Isolation du contexte des sous-agents

Un sous-agent ne doit pas automatiquement hériter de l'intégralité de la conversation principale.

Warden doit créer un `TaskContext` minimal.

```text
Warden
  │
  ├── conversation complète
  │
  ▼
Context Builder
  │
  ▼
TaskContext
  │
  ▼
Sub-agent
```

Le contexte peut contenir :

- objectif de la tâche ;
- fichiers pertinents ;
- résultats d'Inspector ;
- mémoire pertinente ;
- skills nécessaires ;
- contraintes ;
- dépendances du DAG ;
- décisions importantes.

Cette isolation doit permettre de réduire fortement la consommation de tokens.

---

# 15. Context Inspector

Warden doit disposer d'un inspecteur de contexte.

Il doit permettre d'observer, par agent :

```text
System instructions
Project instructions
Critical memory
Lazy memory recalls
Skills
Conversation
Task context
Tool results
```

Exemple :

```text
Builder context

System               4.2k
Project               1.3k
Critical memory       0.8k
Lazy memory           0.6k
Skills                3.1k
Task context           6.7k
Tool results           4.4k
──────────────────────────
Total                 21.1k
```

Le Context Inspector est considéré comme une fonctionnalité centrale de Warden.

---

# 16. Task DAG

Les tâches complexes doivent pouvoir être représentées sous forme de graphe de dépendances.

Exemple :

```text
               Inspect auth
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
Research OAuth              Inspect tests
        │                       │
        └───────────┬───────────┘
                    ▼
                Implement
                    │
                    ▼
                  Tests
                    │
                    ▼
                 Review
```

Chaque tâche doit disposer d'un état :

```text
pending
ready
running
completed
failed
blocked
cancelled
```

L'interface doit afficher le DAG de manière compréhensible.

---

# 17. Validation dynamique

Warden doit adapter le niveau de validation à la complexité ou au risque de la tâche.

## Tâche simple

```text
Implementation
      ↓
Verification
```

## Tâche importante

```text
Implementation
      ↓
Spec Review
      ↓
Quality Review
      ↓
Tests
```

Les critères déterminant la stratégie doivent pouvoir évoluer avec les évaluations du système.

---

# 18. Gestion des échecs

Un échec d'agent ne doit pas automatiquement provoquer l'utilisation d'un modèle plus puissant.

Les échecs doivent être catégorisés.

Exemples :

```text
missing_context
wrong_approach
tool_error
permission_denied
test_failure
model_limit
ambiguous_requirement
unknown
```

Warden pourra ensuite choisir la réaction appropriée :

```text
Failure
   │
   ▼
Classification
   │
   ├── missing_context ──► Inspector
   ├── tool_error ───────► retry/tool strategy
   ├── wrong_approach ───► new plan
   └── model_limit ──────► stronger model
```

L'escalade automatique vers un modèle supérieur sera étudiée après le MVP.

---

# 19. Permissions

Chaque agent possède une politique de permissions.

Exemple :

```yaml
inspector:
  filesystem:
    read: true
    write: false

  shell:
    safeRead: true

  network: false

  git:
    read: true
    write: false
```

Les permissions doivent être modifiables depuis l'interface.

---

# 20. Classification des opérations sensibles

Les outils doivent pouvoir distinguer plusieurs catégories d'actions :

```text
READ
SAFE_WRITE
DANGEROUS
EXTERNAL_SIDE_EFFECT
```

Exemples :

```text
read file                READ
edit source file         SAFE_WRITE
delete many files        DANGEROUS
git push                 EXTERNAL_SIDE_EFFECT
npm publish              EXTERNAL_SIDE_EFFECT
production deployment    EXTERNAL_SIDE_EFFECT
```

Les actions critiques peuvent nécessiter une confirmation explicite selon le mode d'autonomie.

---

# 21. Modes d'autonomie

Warden doit proposer plusieurs modes clairement expliqués dans l'interface.

## Ask

Warden analyse mais ne modifie pas le projet.

## Guided

Warden travaille mais demande confirmation pour les décisions ou actions importantes.

## Auto

Warden peut réaliser une tâche complète, dans la limite de ses permissions, mais ne réalise pas automatiquement les opérations externes sensibles.

## Full

Mode d'autonomie avancé permettant une orchestration plus large selon les permissions définies.

Le détail exact des permissions reste configurable indépendamment du mode.

---

# 22. Skills

Les skills ne doivent pas être chargés intégralement au démarrage.

Warden conserve uniquement leur metadata.

Exemple :

```yaml
name: nestjs
description: Patterns and practices for NestJS applications
estimatedContextTokens: 3400
```

Lorsque nécessaire :

```text
Task
  ↓
Skill detection
  ↓
load skill
  ↓
Agent context
```

L'interface doit afficher :

```text
Skills loaded

nestjs              +3.4k
testing             +1.8k
────────────────────────
Context impact      +5.2k
```

---

# 23. Skills spécifiques aux agents

Un skill peut être :

- global ;
- disponible uniquement pour certains agents ;
- propre à un projet.

Exemple :

```yaml
compatibleAgents:
  - builder
  - reviewer
```

---

# 24. Manifest des skills

Un skill pourra disposer d'un manifest contenant notamment :

```yaml
name: database-migration
version: 1.2.0

estimatedContextTokens: 3200

requires:
  tools:
    - filesystem.read
    - filesystem.write
    - shell

compatibleAgents:
  - builder
```

Les skills installés depuis une source externe devront être considérés comme du contenu potentiellement non fiable.

---

# 25. MCP

Warden doit permettre de configurer des serveurs MCP.

La configuration doit être accessible depuis l'interface.

L'utilisateur doit pouvoir contrôler :

- activation ;
- configuration ;
- agents autorisés ;
- outils autorisés.

Exemple :

```text
GitHub MCP

Agents
✓ Warden
✓ Navigator
☐ Builder

Tools
✓ search
✓ repository.read
☐ issue.write
```

Les appels MCP doivent apparaître dans les traces de session.

---

# 26. Mémoire projet

La mémoire de Warden est spécifique au projet.

Ce qui est appris dans un projet ne doit pas automatiquement s'appliquer à un autre.

La mémoire est divisée en deux niveaux.

---

# 27. Critical Memory

La mémoire critique contient un petit nombre d'informations fondamentales.

Elle peut être chargée systématiquement.

Exemples :

- stack principale ;
- architecture majeure ;
- contraintes fondamentales ;
- conventions critiques ;
- décisions explicitement verrouillées.

La taille de cette mémoire doit rester limitée.

Objectif indicatif :

```text
500 à 2 000 tokens
```

---

# 28. Lazy Memory

La mémoire secondaire n'est chargée que lorsqu'elle devient pertinente.

Elle peut inclure :

- patterns ;
- conventions secondaires ;
- erreurs déjà rencontrées ;
- solutions antérieures ;
- connaissances spécifiques ;
- décisions historiques ;
- bonnes pratiques découvertes.

---

# 29. Memory Watcher

Warden doit à terme disposer d'un composant équivalent conceptuellement à Kibitzer.

Son rôle est d'éviter que Warden oublie de rechercher une mémoire pertinente.

Architecture envisagée :

```text
                    Session
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
           Warden          Memory Watcher
                               │
                               ▼
                        Candidate retrieval
                               │
                      relevant memory?
                               │
                               ▼
                            Warden
```

Le Memory Watcher doit rester économique.

Une approche envisageable :

```text
deterministic retrieval
        ↓
candidate memories
        ↓
lightweight classifier
        ↓
optional small LLM
```

---

# 30. Provenance de la mémoire

Une connaissance stockée doit pouvoir indiquer son origine.

Exemple :

```yaml
type: convention
value: Controllers contain no business logic

source:
  type: observation
  files:
    - src/controllers/*

confidence: 0.94
observations: 17
```

Ou :

```yaml
source:
  type: user_instruction
  session: 42

confidence: 1
locked: true
```

L'utilisateur doit pouvoir demander :

> Pourquoi Warden pense-t-il cela ?

---

# 31. Apprentissage contrôlé

Warden ne doit pas transformer automatiquement chaque observation en convention permanente.

Cycle envisagé :

```text
Observation
    ↓
Candidate memory
    ↓
Repeated confirmation
    ↓
Project knowledge
```

Exemple :

```text
Candidate

"Services use Result<T, E>"

Observed: 3 times
Confidence: 0.64
```

Puis :

```text
Observed: 18 times
Confidence: 0.97

→ promotion possible
```

Une instruction explicite de l'utilisateur peut produire une connaissance immédiatement verrouillée.

---

# 32. Oubli et obsolescence

La mémoire doit pouvoir évoluer.

États potentiels :

```text
active
superseded
deprecated
archived
```

Exemple :

```text
Jest
   ↓ superseded by
Vitest
```

Une mémoire ancienne ne doit pas continuer à influencer Warden lorsqu'une information plus récente la remplace.

---

# 33. Mesure de l'impact de la mémoire

Warden doit mesurer l'efficacité de son système de mémoire.

Exemple :

```text
Memory impact

Candidates inspected       37
Watcher activations         8
Memories surfaced           3
Memories used               2

Tokens consumed           6.8k
Estimated cost           $0.012
```

Cela permettra de déterminer expérimentalement si le Memory Watcher apporte réellement une amélioration.

---

# 34. ADR et décisions architecturales

Warden pourra enregistrer certaines décisions architecturales importantes.

Exemple :

```text
Decision
Use JWT access + refresh tokens

Reason
Mobile application and stateless backend

Alternatives
Session cookies

Consequences
Token rotation required
```

Ces décisions doivent rester compactes et ne doivent pas être chargées systématiquement dans le contexte.

Elles appartiennent à la Lazy Memory sauf décision critique.

---

# 35. Tool Proxy

Les agents ne doivent idéalement pas consommer directement la sortie brute de certains outils.

Warden doit disposer d'une couche :

```text
Agent
  │
  ▼
Warden Tool Proxy
  │
  ├── execute
  ├── filter
  ├── truncate
  ├── deduplicate
  ├── compress
  └── cache
  │
  ▼
Agent Context
```

---

# 36. Tool Output Compression

Une sortie importante doit pouvoir être transformée.

Exemple :

```text
npm test

Raw output
17,843 tokens

Injected
1,480 tokens

Result
127 tests
124 passed
3 failed

Relevant failures:
auth.service.spec.ts:84
auth.service.spec.ts:106
user.e2e.ts:42
```

L'interface doit permettre de visualiser l'économie réalisée :

```text
Raw tool output       182k
Injected               31k
Saved                  83%
```

Warden devra d'abord évaluer les solutions existantes telles que RTK ou outils similaires avant de réimplémenter ses propres mécanismes.

---

# 37. Cache déterministe

Warden peut mettre en cache certaines opérations lorsqu'il peut démontrer que leur source n'a pas changé.

Exemples :

- contenu de package.json ;
- tsconfig ;
- structure de répertoire ;
- métadonnées de dépendances ;
- recherches de symboles ;
- certaines commandes Git.

Le cache sémantique n'est pas prévu dans le MVP.

---

# 38. Event Bus

Le cœur de Warden doit être event-driven.

Exemples d'événements :

```text
session.started
session.completed

task.created
task.started
task.completed
task.failed

agent.started
agent.completed

model.selected

skill.loaded
skill.unloaded

tool.started
tool.completed

memory.recalled
memory.learned
memory.superseded

context.updated

checkpoint.created
```

Un événement doit pouvoir transporter les metadata utiles au tracing et à l'interface.

---

# 39. Tracing

Warden doit produire des traces structurées.

Exemple :

```text
Session #152
│
├── Task #1
│   └── Inspector
│       ├── skill.load
│       ├── search
│       └── read
│
└── Task #2
    └── Builder
        ├── model
        ├── write
        ├── test
        └── model
```

Le tracing doit permettre de mesurer :

- durée ;
- tokens ;
- coût estimé ;
- appels outils ;
- erreurs ;
- sous-tâches ;
- relations parent/enfant.

---

# 40. Token accounting

Warden doit suivre lorsque disponible :

```text
input tokens
output tokens
cached input
reasoning tokens
tool context
```

Les mesures doivent pouvoir être affichées :

- par appel ;
- par agent ;
- par tâche ;
- par session.

---

# 41. Coût

Warden doit calculer le coût estimé des sessions.

La fonctionnalité **budget-aware orchestration n'est pas prévue**.

Warden ne doit donc pas modifier volontairement son comportement pour respecter un budget maximum dans le MVP.

Le suivi financier est principalement une fonctionnalité d'observabilité.

Exemple :

```text
Session

Input tokens       182k
Output tokens       24k
Cached              94k

Estimated cost     $0.84
```

---

# 42. Checkpoints

Warden doit enregistrer régulièrement l'état logique d'une session.

Un checkpoint peut inclure :

- objectif ;
- DAG ;
- tâches terminées ;
- tâche active ;
- décisions ;
- fichiers modifiés ;
- résultats importants ;
- état des agents ;
- résumé de contexte.

---

# 43. Reprise de session

Au redémarrage :

```text
Incomplete session found

Google OAuth
Yesterday
1h 18m
$0.74

5 / 8 tasks completed

[ Resume ]
[ Inspect ]
[ Archive ]
```

La reprise ne doit pas nécessiter le rechargement intégral de la conversation précédente.

Un contexte compact doit être reconstruit à partir :

- du checkpoint ;
- du DAG ;
- des modifications actuelles ;
- de la mémoire pertinente ;
- des résumés précédents.

---

# 44. Persistance des sessions

Structure indicative :

```text
.warden/
└── sessions/
    └── <session-id>/
        ├── state.json
        ├── events.jsonl
        ├── traces.jsonl
        ├── dag.json
        └── artifacts/
```

Les sessions complètes ne sont pas destinées à être versionnées dans Git par défaut.

---

# 45. Developer Tools

Warden doit proposer une zone dédiée au diagnostic.

Elle pourra contenir :

- Session Replay ;
- Context Inspector ;
- Event Viewer ;
- Trace Viewer ;
- Model Routing ;
- Tool Calls ;
- Memory Events ;
- Permission Decisions ;
- Cache Hits ;
- Raw Events ;
- erreurs internes.

---

# 46. Session Replay

Le Session Replay permet d'inspecter une session passée.

Il ne signifie pas nécessairement réexécuter les appels aux modèles.

La première implémentation doit permettre de rejouer visuellement :

```text
User request
      ↓
Task creation
      ↓
Agent selection
      ↓
Skill loading
      ↓
Tool calls
      ↓
Model calls
      ↓
Review
      ↓
Result
```

Une véritable réexécution pourra être étudiée ultérieurement.

---

# 47. Decision Engine

Warden doit permettre plusieurs stratégies de décision.

Architecture cible :

```text
Decision
   │
   ▼
Deterministic rules
   │
   ├── confidence sufficient ──► action
   │
   ▼
Structured classifier
   │
   ├── confidence sufficient ──► action
   │
   ▼
LLM reasoning
```

---

# 48. Intégration potentielle de Jev

Jev peut être utilisé comme Decision Engine optionnel.

Cas d'usage potentiels :

- choix de catégorie ;
- classification d'une tâche ;
- sélection d'un workflow ;
- classification d'une erreur ;
- décision de rappeler une mémoire ;
- estimation de risque ;
- détermination du niveau de validation ;
- certaines décisions binaires ou à choix limités.

Jev ne remplace pas les LLM pour :

- développement ;
- raisonnement architectural ;
- debugging complexe ;
- génération de code ;
- analyse approfondie.

L'intégration doit rester optionnelle.

Warden ne doit pas dépendre de Jev pour fonctionner.

---

# 49. Observabilité du Decision Engine

L'interface doit pouvoir afficher :

```text
Routing decision

debugging         82%
deep-debug        11%
quick              5%
implementation     2%

Selected
debugging

Decision engine
Jev

Confidence
82%
```

Les évaluations futures permettront de mesurer la pertinence des décisions automatiques.

---

# 50. Configuration globale et projet

Warden doit gérer plusieurs niveaux de configuration.

Ordre de priorité :

```text
Warden defaults
      ↓
Global user configuration
      ↓
Project configuration
```

Structure :

```text
~/.warden/
├── config.yaml
├── agents/
├── categories/
├── skills/
└── mcp/
```

Projet :

```text
project/
└── .warden/
    ├── config.yaml
    ├── memory/
    ├── skills/
    └── checkpoints/
```

---

# 51. Secrets

Les secrets ne doivent jamais être intégrés aux fichiers destinés à Git.

Exemples :

- API keys ;
- tokens OAuth ;
- credentials ;
- secrets MCP.

Les références peuvent utiliser :

```yaml
apiKey: ${ANTHROPIC_API_KEY}
```

ou un secret store local.

---

# 52. Synchronisation multi-device

La configuration globale doit pouvoir être versionnée dans un dépôt Git séparé.

Exemple :

```text
github.com/user/warden-config
```

Warden pourra fournir à terme :

```bash
warden config init
warden config connect
warden sync
```

Le dépôt peut contenir :

```text
config
agents
categories
skills
MCP definitions
```

mais pas :

```text
API keys
credentials
machine-specific secrets
```

---

# 53. Mémoire projet et Git

La mémoire projet durable peut être versionnée avec le projet.

Exemple :

```text
project/
└── .warden/
    ├── memory/
    ├── skills/
    └── config.yaml
```

Les données volumineuses doivent être exclues.

Exemple `.gitignore` :

```gitignore
.warden/sessions/
.warden/cache/
```

---

# 54. Distribution de Warden

Le code source sera hébergé sur GitHub.

La distribution ne doit pas dépendre d'un clone manuel du repository.

Pour l'écosystème TypeScript envisagé, une distribution npm est adaptée.

Exemple potentiel :

```bash
npm install -g @warden-ai/warden
```

---

# 55. Mise à jour

Warden devra proposer :

```bash
warden update
```

L'installation de Warden et la configuration utilisateur doivent être séparées.

Une mise à jour du runtime ne doit pas supprimer ou remplacer la configuration utilisateur.

---

# 56. Canaux de mise à jour

À terme :

```text
stable
beta
dev
```

Exemples :

```bash
warden update
warden update --beta
warden update --dev
```

---

# 57. Migrations

Les configurations doivent disposer d'un numéro de schéma.

Exemple :

```yaml
warden:
  configVersion: 3
```

Lors d'une mise à jour :

```text
Current config
v2

Required
v3

→ backup
→ migration
→ validation
→ startup
```

Les migrations doivent être réversibles lorsque raisonnablement possible ou au minimum créer une sauvegarde.

---

# 58. Warden Doctor

Une commande de diagnostic doit être disponible.

```bash
warden doctor
```

Elle peut vérifier :

- version Warden ;
- version Pi ;
- Node/runtime ;
- providers disponibles ;
- credentials manquants ;
- modèles configurés ;
- MCP ;
- skills ;
- configuration ;
- schéma ;
- permissions ;
- problèmes connus.

---

# 59. Interface initiale : TUI

La première interface de Warden sera une TUI.

Objectifs :

- rester proche du workflow des développeurs ;
- simplifier le développement initial ;
- expérimenter rapidement l'UX ;
- tester quelles informations sont réellement utiles ;
- éviter de figer prématurément une application desktop.

---

# 60. Dashboard TUI

Exemple conceptuel :

```text
┌ WARDEN ─────────────────────────────────────────────────────┐
│ Project: project-name                         AUTO ●         │
│ Session: 42m 18s       Tokens: 183k          $0.84         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Warden                                                       │
│ ● Coordinating OAuth implementation                          │
│                                                              │
│ ├ ✓ Inspector       auth architecture             $0.02     │
│ ├ ✓ Navigator       OAuth documentation           $0.03     │
│ ├ ● Builder         implementing callback         $0.21     │
│ └ ○ Reviewer        waiting                       --        │
│                                                              │
├──────────────────────────────┬───────────────────────────────┤
│ Task DAG                     │ Context                       │
│                              │                               │
│ inspect ─┐                   │ Warden    18.4k / 64k         │
│          ├─► build ─► review │ Builder    9.2k / 32k        │
│ docs ────┘                   │ Skills     +3.1k              │
│                              │ Memory     +0.8k              │
├──────────────────────────────┴───────────────────────────────┤
│ > _                                                          │
└──────────────────────────────────────────────────────────────┘
```

---

# 61. Application desktop

Une application native/desktop est prévue comme évolution future.

Elle utilisera le même runtime que la TUI.

Architecture :

```text
                    Warden Core
                         │
                  Warden Runtime
                         │
                     Event Bus
                         │
             ┌───────────┴────────────┐
             ▼                        ▼
          Warden TUI             Warden Desktop
```

Une piste technique naturelle dans un environnement TypeScript serait :

```text
Tauri
+
React
```

Cette décision n'est pas nécessaire pour la v0.1.

---

# 62. CLI non interactive

Warden doit à terme pouvoir fonctionner sans TUI.

Exemple :

```bash
warden run "fix all lint errors"
```

ou :

```bash
warden run \
  --mode auto \
  --output json \
  "run the tests and fix failures"
```

Cette capacité permettra ultérieurement une utilisation dans :

- scripts ;
- CI/CD ;
- IDE ;
- automatisations ;
- outils externes.

---

# 63. Extensibilité

Warden est initialement un harness **opinionated mais configurable**.

La priorité n'est pas de créer immédiatement une plateforme universelle.

La v0.x ne nécessite pas :

- marketplace ;
- Plugin SDK complet ;
- API d'orchestrateur tiers ;
- système de plugins arbitraire.

Principe :

> Configurable does not mean everything must be a plugin.

---

# 64. Evaluations

Warden doit disposer progressivement d'une suite d'évaluation interne.

Exemples de scénarios :

```text
simple-fix
debugging
feature-small
research
refactor
ambiguous-task
```

Métriques possibles :

```text
success
tests passing
tokens
estimated cost
execution time
number of agents
number of LLM calls
number of tool calls
unnecessary delegation
memory usefulness
routing accuracy
```

---

# 65. Objectif des évaluations

Les évaluations doivent permettre de comparer deux versions de Warden.

Exemple :

```text
                     v0.4       v0.5

Success               87%        91%
Average tokens         82k        61k
Estimated cost       $0.42      $0.31
Tool calls             31         24
Agents spawned         4.1        2.8
```

Une fonctionnalité ajoutant de la complexité doit idéalement démontrer qu'elle apporte une amélioration mesurable.

---

# 66. Périmètre MVP — v0.1

La première version doit volontairement rester limitée.

## Runtime

- intégration Pi ;
- système d'événements ;
- persistance de session ;
- architecture provider/model abstraite.

## Agents

- Warden ;
- Inspector ;
- Navigator ;
- Builder ;
- Reviewer.

## Orchestration

- délégation ;
- contexte isolé ;
- catégories ;
- DAG simple ;
- un seul agent d'écriture simultané ;
- validation dynamique basique.

## Configuration

- modèles configurables ;
- catégories configurables ;
- permissions configurables ;
- configuration globale ;
- configuration projet.

## Skills

- registre ;
- metadata ;
- lazy loading ;
- estimation du coût contextuel.

## MCP

- chargement ;
- configuration ;
- permissions basiques.

## Mémoire

- Critical Memory ;
- Lazy Memory simple ;
- provenance ;
- stockage projet.

Le Memory Watcher intelligent peut être expérimental ou reporté après stabilisation de la mémoire de base.

## Outils

- Tool Proxy ;
- troncature ;
- filtrage ;
- compression simple ;
- exploration des outils existants type RTK.

## Observabilité

- tokens ;
- coût estimé ;
- temps ;
- agents actifs ;
- tâches ;
- modèles ;
- skills ;
- outils ;
- Context Inspector initial.

## Sessions

- checkpoints ;
- reprise ;
- historique.

## Interface

- TUI ;
- dashboard ;
- configuration ;
- visualisation des agents ;
- visualisation du DAG ;
- détails de session.

## CLI

- lancement ;
- diagnostic ;
- configuration.

---

# 67. Fonctionnalités volontairement exclues de la v0.1

Les fonctionnalités suivantes ne sont pas prioritaires :

```text
Parallel Builders
Git worktrees
Budget-aware orchestration
Semantic cache
Full automatic escalation
Desktop application
Plugin marketplace
Advanced Memory Watcher
Advanced Jev routing
Cloud synchronization service
Remote execution
Full session re-execution
```

Elles doivent être envisagées seulement si l'usage réel démontre leur intérêt.

---

# 68. Roadmap indicative

## v0.1 — Foundation

Objectif :

> disposer d'un Warden utilisable quotidiennement sur des tâches réelles.

Fonctionnalités majeures :

- runtime Pi ;
- agents ;
- catégories ;
- TUI ;
- DAG ;
- contexte isolé ;
- permissions ;
- skills lazy ;
- MCP ;
- mémoire projet ;
- observabilité ;
- checkpoints ;
- Tool Proxy.

---

## v0.2 — Reliability

Objectif :

> rendre l'orchestration robuste et mesurable.

Évolutions possibles :

- meilleur routing ;
- recovery engine ;
- validation dynamique avancée ;
- meilleure compression outils ;
- cache déterministe ;
- traces avancées ;
- Session Replay ;
- premières evals systématiques.

---

## v0.3 — Intelligence

Objectif :

> permettre à Warden d'exploiter réellement son historique.

Évolutions possibles :

- Memory Watcher ;
- apprentissage contrôlé ;
- détection des connaissances obsolètes ;
- confidence scoring ;
- ADR compacts ;
- meilleure récupération de mémoire ;
- évaluation de l'impact mémoire.

---

## v0.4 — Decision Layer

Objectif :

> réduire les appels LLM dédiés aux décisions simples.

Évolutions possibles :

- moteur de décision abstrait ;
- règles déterministes ;
- intégration Jev expérimentale ;
- classification des erreurs ;
- routing probabiliste ;
- mesure d'accuracy ;
- fallback vers LLM.

---

## v0.5+ — Scale & UX

Évolutions possibles :

- application desktop ;
- agents d'écriture parallèles ;
- Git worktrees ;
- intégration CI ;
- mode headless avancé ;
- meilleure synchronisation multi-device ;
- extensions supplémentaires.

---

# 69. Arborescence projet envisagée

Exemple indicatif :

```text
warden/
├── packages/
│   ├── core/
│   ├── runtime/
│   ├── memory/
│   ├── observability/
│   ├── tui/
│   └── cli/
│
├── evals/
│
├── docs/
│
├── skills/
│
├── examples/
│
├── package.json
└── README.md
```

---

# 70. Arborescence `.warden`

Exemple projet :

```text
.warden/
├── config.yaml
│
├── memory/
│   ├── critical.md
│   ├── knowledge/
│   ├── conventions/
│   └── decisions/
│
├── skills/
│
├── checkpoints/
│
├── sessions/
│
└── cache/
```

Certains dossiers seront exclus de Git.

---

# 71. Critères de réussite de la v0.1

La v0.1 sera considérée comme réellement utilisable si elle permet :

1. de lancer Warden depuis un terminal sur un projet réel ;
2. de dialoguer normalement avec l'orchestrateur ;
3. de déléguer une recherche à Inspector ;
4. de déléguer une recherche externe à Navigator ;
5. de déléguer une implémentation à Builder ;
6. de faire vérifier une modification par Reviewer ;
7. de modifier les modèles associés aux catégories ;
8. de modifier les permissions depuis la TUI ;
9. de voir en temps réel quel agent travaille ;
10. de voir la tâche actuellement réalisée ;
11. de visualiser le DAG ;
12. de mesurer les tokens ;
13. d'estimer les coûts ;
14. de mesurer le temps ;
15. de voir les skills chargés ;
16. d'inspecter le contexte d'un agent ;
17. de charger un MCP ;
18. de conserver une mémoire propre au projet ;
19. de reprendre une session interrompue ;
20. de retrouver le même comportement après installation de Warden sur une autre machine et récupération de la configuration Git.

---

# 72. Indicateurs produit principaux

Les métriques les plus importantes pour Warden ne sont pas uniquement les performances brutes du modèle.

Les indicateurs à suivre sont notamment :

```text
Task success rate
Tokens / successful task
Estimated cost / successful task
Time / successful task
Context size
Tool-output reduction
Unnecessary agent calls
Average agents / task
Memory usefulness
Routing accuracy
Recovery success rate
```

---

# 73. Risques principaux

## Sur-orchestration

Risque :

Warden reproduit progressivement la complexité d'OmO.

Réponse :

- evals ;
- orchestration minimale ;
- suppression des fonctionnalités sans bénéfice mesurable.

## Explosion du contexte

Réponse :

- isolation ;
- lazy skills ;
- dual memory ;
- Tool Proxy ;
- Context Inspector.

## Mémoire erronée

Réponse :

- provenance ;
- confidence ;
- controlled learning ;
- obsolescence ;
- audit.

## Complexité UI

Réponse :

- commencer avec une TUI ;
- observer l'usage réel ;
- ne construire le desktop qu'ensuite.

## Verrouillage provider

Réponse :

- Model Registry ;
- Provider abstraction ;
- configuration indépendante.

## Actions dangereuses

Réponse :

- permissions ;
- classification du risque ;
- confirmations ;
- modes d'autonomie.

---

# 74. Non-objectifs

Warden n'a pas pour objectif initial de :

- remplacer Pi ;
- créer son propre LLM ;
- être un IDE ;
- remplacer Git ;
- fournir une infrastructure cloud ;
- exécuter plusieurs Builders simultanément ;
- devenir immédiatement une plateforme de plugins ;
- proposer le plus grand nombre possible d'agents ;
- dépenser automatiquement un budget donné ;
- masquer la complexité de son fonctionnement.

Au contraire, Warden doit rendre cette complexité **visible et contrôlable**.

---

# 75. Proposition de valeur

Warden se distingue principalement par quatre axes.

## Observable

Le développeur voit ce qui se passe.

## Context-efficient

Chaque agent reçoit uniquement ce dont il a besoin.

## Auditable

Les décisions, la mémoire et les permissions sont inspectables.

## Adaptive

Warden adapte l'orchestration à la tâche et apprend progressivement les particularités du projet.

---

# 76. Positionnement

Warden ne cherche pas à être :

> le harness disposant du plus grand nombre d'agents.

Il cherche à devenir :

> **un harness agentique de développement transparent, maîtrisable et mesurable.**

Sa promesse peut être résumée ainsi :

> **You see who is working, why, with which model, which context, which skills, how much it costs, how many tokens are saved, and what Warden learns from your project.**

---

# 77. Principe directeur

Lorsqu'une décision d'architecture ou une nouvelle fonctionnalité est envisagée, l'équipe doit pouvoir se poser les questions suivantes :

> Est-ce que cela améliore réellement la capacité de Warden à accomplir une tâche ?

> Est-ce que cela réduit ou justifie son coût en contexte et en orchestration ?

> Est-ce que l'utilisateur peut comprendre ce qui se passe ?

> Est-ce que l'on peut mesurer son impact ?

Si aucune réponse positive ne peut être démontrée, la fonctionnalité ne doit pas être ajoutée uniquement parce qu'elle est techniquement intéressante.

---

# 78. Résumé

Warden sera initialement un **harness agentique de développement en TUI basé sur Pi**, construit autour :

```text
Small agent roster
        +
Task categories
        +
Isolated contexts
        +
Dynamic orchestration
        +
Lazy skills
        +
Project memory
        +
MCP
        +
Tool optimization
        +
Fine-grained permissions
        +
Checkpoints
        +
Full observability
```

Sa priorité n'est pas d'automatiser le maximum de choses.

Sa priorité est d'obtenir un système suffisamment intelligent pour orchestrer le travail efficacement tout en donnant au développeur une compréhension précise de son comportement.

**Warden makes agentic coding observable and cost-aware.**