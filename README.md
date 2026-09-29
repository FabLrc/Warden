# Warden

Warden is an observable, context-isolated development-agent harness built on Pi.

## Prerequisites

- Node.js 22.19 or newer
- A configured Pi provider for real agent runs

## Install and verify

```bash
npm install --legacy-peer-deps
npm test
npm run build
```

## Run

```bash
npm run dev -- run "summarize this project"
npm run dev -- doctor
npm run dev -- config
npm run dev -- sessions
npm run dev -- resume <session-id>
```

Warden writes its logical session state under `.warden/sessions/`. `state.json`
is the authoritative checkpoint; `events.jsonl` is an audit log whose final
truncated line is ignored on recovery.

Runs end with a metrics line (tokens, cost, duration). When the provider does
not report a billed cost, Warden estimates it from live models.dev prices cached
in `~/.warden/cache/models-dev.json` for 24h. With OpenRouter models configured
and `OPENROUTER_API_KEY` set, the run also shows the live plan quota and records
a `usage.limits` event. `warden doctor` reports the price cache age and quota
setup.

`warden config` prints the effective, merged configuration without MCP
environment values. `warden sessions` lists saved sessions. `warden resume
<session-id>` resumes the first incomplete task from its authoritative
`state.json` checkpoint. A task interrupted while running is retried after
being checkpointed as recoverable, and the agent is told to inspect the
workspace first.

Foundation uses Pi's in-memory session manager. Resume starts a fresh Pi
session with the saved Warden task, not a Pi transcript or conversation resume.

Warden's Foundation tool policy is not an operating-system sandbox. Pi and its
tools retain the permissions of the process that launches them.
