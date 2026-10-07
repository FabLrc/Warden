import { Activity, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HarnessBadge, SupportBadge } from "@/components/warden/badges";
import { DiffStat } from "@/components/warden/diff-view";
import { ObservedValue } from "@/components/warden/observation";
import { KeyValue } from "@/components/warden/page";
import { formatCost, formatDuration, formatNumber, formatTokens } from "@/lib/format";
import { INTEGRATION_LABELS, PERMISSION_DECISION_LABELS, PERMISSION_KIND_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { getAgent, getHarness, getModel, getProfile, getProvider, getSkill } from "@/mock/queries";
import type { HarnessId, SessionMetrics, TraceEvent } from "@/mock/types";

export interface InspectorConfig {
  harnessId: HarnessId;
  providerId: string;
  modelId: string;
  profileId?: string;
  agentId?: string;
  skillIds: string[];
}

export interface InspectorFile {
  path: string;
  additions: number;
  deletions: number;
  href: string;
}

const METRIC_ROWS: { key: keyof SessionMetrics; label: string; format: (v: number) => string }[] = [
  { key: "durationMs", label: "Durée", format: formatDuration },
  { key: "inputTokens", label: "Tokens entrée", format: formatTokens },
  { key: "outputTokens", label: "Tokens sortie", format: formatTokens },
  { key: "cost", label: "Coût", format: formatCost },
  { key: "modelCalls", label: "Appels modèle", format: formatNumber },
  { key: "toolCalls", label: "Tool calls", format: formatNumber },
  { key: "errors", label: "Erreurs", format: formatNumber },
  { key: "permissionsRequested", label: "Permissions", format: formatNumber },
];

function Block({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-1">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function MetricsList({ metrics }: { metrics: SessionMetrics }) {
  return (
    <div>
      {METRIC_ROWS.map((row) => (
        <KeyValue key={row.key} label={row.label}>
          <ObservedValue obs={metrics[row.key]} format={row.format} />
        </KeyValue>
      ))}
    </div>
  );
}

/** Session inspector: configuration, metrics (with confidence), files changed, permission log, link to Observe. */
export function SessionInspector({
  config,
  metrics,
  metricsTitle = "Métriques",
  live,
  files,
  permissions,
  observeHref,
}: {
  config: InspectorConfig;
  metrics: SessionMetrics | null;
  metricsTitle?: string;
  /** Metrics of a live run appended to a recorded session (resume). */
  live?: SessionMetrics | null;
  files: InspectorFile[];
  permissions: TraceEvent[];
  /** Undefined: the session is not recorded yet. */
  observeHref?: string;
}) {
  const harness = getHarness(config.harnessId);
  const profile = config.profileId ? getProfile(config.profileId) : undefined;
  const agent = config.agentId ? getAgent(config.agentId) : undefined;
  return (
    <div className="space-y-5">
      <Block title="Harness">
        <KeyValue label="Harness">
          <HarnessBadge harnessId={harness.id} />
        </KeyValue>
        <KeyValue label="Version">
          <span className="font-mono text-xs">
            {harness.version ?? "—"}
            {harness.latestVersion && harness.latestVersion !== harness.version && (
              <span className="text-warning"> → {harness.latestVersion}</span>
            )}
          </span>
        </KeyValue>
        <KeyValue label="Intégration">
          <span className="text-xs">
            {INTEGRATION_LABELS[harness.integration]}
            {harness.adapter && <span className="block font-mono text-muted-foreground">{harness.adapter}</span>}
          </span>
        </KeyValue>
      </Block>

      <Block title="Modèle">
        <KeyValue label="Provider">{getProvider(config.providerId).name}</KeyValue>
        <KeyValue label="Modèle">{getModel(config.modelId).name}</KeyValue>
        <KeyValue label="Profil">
          {profile ? (
            <Link to={links.profiles()} className="hover:text-primary">
              {profile.name}
            </Link>
          ) : (
            <span className="text-muted-foreground">Aucun</span>
          )}
        </KeyValue>
        <KeyValue label="Agent">
          {agent ? (
            <span className="inline-flex items-center gap-1.5">
              <Link to={links.agents()} className="hover:text-primary">
                {agent.name}
              </Link>
              <SupportBadge support={agent.compat[harness.id].support} note={agent.compat[harness.id].note} compact />
            </span>
          ) : (
            <span className="text-muted-foreground">Aucun</span>
          )}
        </KeyValue>
        <KeyValue label="Skills">
          {config.skillIds.length === 0 ? (
            <span className="text-muted-foreground">Aucun</span>
          ) : (
            <span className="flex flex-col items-end gap-1">
              {config.skillIds.map((id) => {
                const skill = getSkill(id);
                if (!skill) return null;
                const compat = skill.compat[harness.id];
                return (
                  <span key={id} className="inline-flex items-center gap-1.5">
                    <Link to={links.skills()} className="font-mono text-xs hover:text-primary">
                      {skill.name}
                    </Link>
                    <SupportBadge support={compat.support} note={compat.note} compact />
                  </span>
                );
              })}
            </span>
          )}
        </KeyValue>
      </Block>

      <Separator />

      {live && (
        <Block title="Tour en cours" aside={<span className="size-1.5 animate-soul rounded-full bg-primary" />}>
          <MetricsList metrics={live} />
        </Block>
      )}

      <Block title={metricsTitle}>
        {metrics ? (
          <MetricsList metrics={metrics} />
        ) : (
          <p className="py-1.5 text-xs text-muted-foreground">Les métriques apparaissent dès le premier prompt.</p>
        )}
      </Block>

      <Block title={`Fichiers modifiés · ${files.length}`}>
        {files.length === 0 ? (
          <p className="py-1.5 text-xs text-muted-foreground">Aucun fichier modifié.</p>
        ) : (
          <ul className="space-y-0.5">
            {files.map((f) => (
              <li key={f.href}>
                <Link
                  to={f.href}
                  className="flex items-center gap-2 rounded px-1 py-1 text-xs hover:bg-accent"
                  title="Ouvrir dans Code"
                >
                  <span className="min-w-0 flex-1 truncate font-mono">{f.path}</span>
                  <DiffStat additions={f.additions} deletions={f.deletions} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={`Permissions · ${permissions.length}`}>
        {permissions.length === 0 ? (
          <p className="py-1.5 text-xs text-muted-foreground">Aucune demande de permission.</p>
        ) : (
          <ul className="space-y-1.5">
            {permissions.map((p) => {
              const decision = p.permission?.decision;
              return (
                <li key={p.id} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {p.permission ? PERMISSION_KIND_LABELS[p.permission.kind] : "—"}
                    </span>
                    <span
                      className={cn(
                        "font-medium",
                        decision === "deny" && "text-destructive",
                        decision === "allow-once" && "text-success",
                        decision === "allow-always" && "text-primary",
                        !decision && "text-warning",
                      )}
                    >
                      {decision
                        ? PERMISSION_DECISION_LABELS[decision]
                        : p.status === "pending"
                          ? "En attente"
                          : "Annulée"}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono" title={p.command ?? p.file?.path ?? p.title}>
                    {p.command ?? p.file?.path ?? p.title}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Block>

      {observeHref ? (
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to={observeHref}>
            <Activity /> Observer la session <ArrowUpRight className="ml-auto" />
          </Link>
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block">
              <Button variant="outline" size="sm" className="w-full" disabled>
                <Activity /> Observer la session
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            La trace détaillée sera disponible dans Observe une fois la session enregistrée (non persistée dans la
            maquette).
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
