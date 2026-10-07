import { Info, Pencil, Plug, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ObservedValue } from "@/components/warden/observation";
import { Page, Section } from "@/components/warden/page";
import { formatTokens } from "@/lib/format";
import { cn } from "@/lib/utils";
import { harnesses } from "@/mock/fixtures/catalog";
import { agents, mcpServers } from "@/mock/fixtures/workspace";
import { getAgent } from "@/mock/queries";
import type { Confidence, Harness, HarnessId, McpServer, Observation } from "@/mock/types";

const STATUS_META: Record<McpServer["status"], { label: string; dot: string; text: string }> = {
  connected: { label: "Connecté", dot: "bg-success", text: "text-success" },
  disconnected: { label: "Déconnecté", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  error: { label: "Erreur", dot: "bg-destructive", text: "text-destructive" },
};

const formatTokenCount = (n: number) => `${formatTokens(n)} tokens`;

/** Why a harness cannot load MCP servers at all, or `null` when it can. */
function mcpBlocker(h: Harness): string | null {
  const cap = h.capabilities.mcp;
  if (cap.support === "unsupported") return cap.note ?? `${h.name} ne gère pas MCP`;
  return null;
}

/**
 * Context taken by the MCP servers a harness loads. The weakest confidence among summed values wins,
 * and servers without a value are named instead of being counted as 0.
 */
function contextForHarness(servers: McpServer[], h: Harness): Observation<number> {
  const blocker = mcpBlocker(h);
  if (blocker) return { value: null, confidence: "unavailable", note: blocker };
  const loaded = servers.filter((s) => s.harnessIds.includes(h.id));
  if (loaded.length === 0) return { value: 0, confidence: "observed", note: "Aucun serveur MCP chargé" };
  const known = loaded.filter((s) => s.contextTokens.value !== null);
  const missing = loaded.filter((s) => s.contextTokens.value === null).map((s) => s.name);
  if (known.length === 0) return { value: null, confidence: "unavailable", note: `Inconnu : ${missing.join(", ")}` };
  const confidence: Confidence = known.some((s) => s.contextTokens.confidence === "inferred")
    ? "inferred"
    : "estimated";
  return {
    value: known.reduce((sum, s) => sum + (s.contextTokens.value ?? 0), 0),
    confidence,
    source: `somme de ${known.map((s) => s.name).join(", ")}`,
    note: missing.length > 0 ? `Non compté (valeur indisponible) : ${missing.join(", ")}` : undefined,
  };
}

export function McpScreen() {
  const [servers, setServers] = useState<McpServer[]>(mcpServers);
  const [retried, setRetried] = useState<Partial<Record<string, boolean>>>({});

  const update = (id: string, patch: Partial<McpServer>) =>
    setServers((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <Page
      title="MCP"
      subtitle="Serveurs MCP configurés, leurs outils, les agents autorisés et leur poids dans le contexte (CDC §15)."
    >
      <div className="space-y-8">
        <Alert>
          <Info />
          <AlertTitle>Warden affiche et contrôle, le harness exécute</AlertTitle>
          <AlertDescription>
            Warden ne lance pas les serveurs MCP lui-même : il transmet la configuration au harness, qui démarre le
            serveur et appelle ses outils. Un harness sans support MCP ne peut donc pas les utiliser. Maquette : les
            changements restent locaux à cet écran.
          </AlertDescription>
        </Alert>

        <Section title="Poids dans le contexte, par harness">
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
            {harnesses.map((h) => (
              <div key={h.id} className="space-y-1 rounded-lg border border-border bg-card px-3 py-2">
                <div className="text-xs text-muted-foreground">{h.name}</div>
                <ObservedValue obs={contextForHarness(servers, h)} format={formatTokenCount} className="text-sm" />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Schémas d'outils injectés à chaque appel modèle : une couche MCP doit justifier son coût en contexte.
          </p>
        </Section>

        <Section title="Serveurs">
          <div className="space-y-4">
            {servers.map((s) => (
              <ServerCard
                key={s.id}
                server={s}
                retried={retried[s.id] === true}
                onRetry={() => setRetried((r) => ({ ...r, [s.id]: true }))}
                onChange={(patch) => update(s.id, patch)}
              />
            ))}
          </div>
        </Section>
      </div>
    </Page>
  );
}

function ServerCard({
  server: s,
  retried,
  onRetry,
  onChange,
}: {
  server: McpServer;
  retried: boolean;
  onRetry: () => void;
  onChange: (patch: Partial<McpServer>) => void;
}) {
  const status = STATUS_META[s.status];
  const toggleHarness = (id: HarnessId, on: boolean) =>
    onChange({ harnessIds: on ? [...s.harnessIds, id] : s.harnessIds.filter((h) => h !== id) });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Plug className="size-4 text-muted-foreground" />
            <span className="font-mono font-semibold">{s.name}</span>
            <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", status.text)}>
              <span className={cn("size-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
            <span className="rounded border border-border bg-secondary/60 px-1.5 font-mono text-[10px] uppercase text-muted-foreground">
              {s.transport}
            </span>
          </div>
          <code className="block truncate font-mono text-xs text-muted-foreground">{s.endpoint}</code>
          {s.statusDetail && (
            <div
              className={cn("font-mono text-xs", s.status === "error" ? "text-destructive" : "text-muted-foreground")}
            >
              {s.statusDetail}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Contexte</span>
            <ObservedValue obs={s.contextTokens} format={formatTokenCount} />
          </div>
          {s.status !== "connected" && (
            <Button variant="outline" size="xs" onClick={onRetry}>
              <RefreshCw />
              Reconnecter
            </Button>
          )}
          {retried && (
            <span className="max-w-64 text-right text-[11px] text-muted-foreground">
              Reconnexion simulée : la maquette ne contacte aucun serveur.
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 p-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Outils</div>
          {s.tools.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              {s.status === "error"
                ? "Liste des outils inconnue : le serveur est injoignable."
                : "Ce serveur n'expose aucun outil."}
            </p>
          ) : (
            <div className="divide-y divide-border rounded-md border border-border">
              {s.tools.map((t) => (
                <div key={t.name} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <div className="min-w-0">
                    <div className="font-mono text-xs">{t.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{t.description}</div>
                  </div>
                  <ObservedValue obs={t.tokenEstimate} format={formatTokenCount} className="shrink-0 text-xs" />
                </div>
              ))}
            </div>
          )}
          {s.contextTokens.note && <p className="text-[11px] text-muted-foreground">{s.contextTokens.note}</p>}
        </div>

        <div className="space-y-5">
          <AllowedAgents value={s.allowedAgentIds} onChange={(allowedAgentIds) => onChange({ allowedAgentIds })} />

          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Chargé par</div>
            <div className="space-y-1.5">
              {harnesses.map((h) => {
                const blocker = mcpBlocker(h);
                const loaded = s.harnessIds.includes(h.id);
                const row = (
                  <div key={h.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className={cn("flex items-center gap-1.5", blocker && "text-muted-foreground")}>
                      {h.name}
                      {!h.installed && <span className="text-[10px] text-muted-foreground">non installé</span>}
                      {blocker && <span className="text-[10px] text-destructive">MCP non supporté</span>}
                    </span>
                    <Switch
                      size="sm"
                      checked={loaded && !blocker}
                      disabled={blocker !== null}
                      onCheckedChange={(on) => toggleHarness(h.id, on)}
                      aria-label={`Charger ${s.name} dans ${h.name}`}
                    />
                  </div>
                );
                return blocker ? (
                  <Tooltip key={h.id}>
                    <TooltipTrigger asChild>{row}</TooltipTrigger>
                    <TooltipContent>{blocker}</TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={h.id}>{row}</div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AllowedAgents({
  value,
  onChange,
}: {
  value: McpServer["allowedAgentIds"];
  onChange: (value: McpServer["allowedAgentIds"]) => void;
}) {
  const selected = value === "all" ? agents.map((a) => a.id) : value;
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...selected, id] : selected.filter((a) => a !== id);
    onChange(next.length === agents.length ? "all" : next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Agents autorisés</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs">
              <Pencil />
              Modifier
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuCheckboxItem
              checked={value === "all"}
              onCheckedChange={(on) => onChange(on ? "all" : [])}
              onSelect={(e) => e.preventDefault()}
            >
              Tous les agents
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Agents</DropdownMenuLabel>
            {agents.map((a) => (
              <DropdownMenuCheckboxItem
                key={a.id}
                checked={selected.includes(a.id)}
                onCheckedChange={(on) => toggle(a.id, on)}
                onSelect={(e) => e.preventDefault()}
              >
                {a.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {value === "all" ? (
          <span className="rounded border border-primary/30 bg-primary/10 px-1.5 text-xs text-primary">
            Tous les agents
          </span>
        ) : value.length === 0 ? (
          <span className="text-xs text-warning">Aucun agent : outils inaccessibles</span>
        ) : (
          value.map((id) => (
            <span key={id} className="rounded border border-border bg-secondary/60 px-1.5 text-xs">
              {getAgent(id)?.name ?? id}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
