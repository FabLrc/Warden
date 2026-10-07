import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HarnessBadge, WorkloadBadge } from "@/components/warden/badges";
import { Section } from "@/components/warden/page";
import { cn } from "@/lib/utils";
import { getAgent, getModel, getProfile, getProject, getProvider, getSkill } from "@/mock/queries";
import type { Session, TraceEvent } from "@/mock/types";

interface VariableRow {
  label: string;
  /** Counted as an experimental variable (CDC §20); `false` for purely informative rows. */
  controlled: boolean;
  differs: boolean;
  renderA: ReactNode;
  renderB: ReactNode;
}

interface VariableDef {
  label: string;
  controlled: boolean;
  /** Comparable key. */
  key: (s: Session, trace: TraceEvent[]) => string;
  render: (s: Session, trace: TraceEvent[]) => ReactNode;
}

const none = <span className="text-muted-foreground">aucun</span>;

const VARIABLES: VariableDef[] = [
  {
    label: "Projet",
    controlled: true,
    key: (s) => s.projectId,
    render: (s) => getProject(s.projectId)?.name ?? s.projectId,
  },
  {
    label: "Tâche (prompt initial)",
    controlled: true,
    key: (_, trace) => trace.find((e) => e.kind === "user-prompt")?.text ?? "",
    render: (_, trace) => {
      const text = trace.find((e) => e.kind === "user-prompt")?.text;
      return text ? (
        <span className="text-xs" title={text}>
          {text}
        </span>
      ) : (
        none
      );
    },
  },
  {
    label: "Workload",
    controlled: true,
    key: (s) => s.workload,
    render: (s) => <WorkloadBadge workload={s.workload} />,
  },
  {
    label: "Harness",
    controlled: true,
    key: (s) => s.harnessId,
    render: (s) => <HarnessBadge harnessId={s.harnessId} />,
  },
  { label: "Provider", controlled: true, key: (s) => s.providerId, render: (s) => getProvider(s.providerId).name },
  { label: "Modèle", controlled: true, key: (s) => s.modelId, render: (s) => getModel(s.modelId).name },
  {
    label: "Agent",
    controlled: true,
    key: (s) => s.agentId ?? "",
    render: (s) => (s.agentId ? (getAgent(s.agentId)?.name ?? s.agentId) : none),
  },
  {
    label: "Skills",
    controlled: true,
    key: (s) => [...s.skillIds].sort().join(","),
    render: (s) =>
      s.skillIds.length > 0 ? (
        <span className="font-mono text-xs">{s.skillIds.map((id) => getSkill(id)?.name ?? id).join(", ")}</span>
      ) : (
        none
      ),
  },
  {
    label: "Profil",
    controlled: false,
    key: (s) => s.profileId ?? "",
    render: (s) => (s.profileId ? (getProfile(s.profileId)?.name ?? s.profileId) : none),
  },
];

/** CDC §20 — which variables differ between two sessions. */
export function VariablesSection({
  a,
  b,
  traceA,
  traceB,
}: {
  a: Session;
  b: Session;
  traceA: TraceEvent[];
  traceB: TraceEvent[];
}) {
  const rows: VariableRow[] = VARIABLES.map((v) => ({
    label: v.label,
    controlled: v.controlled,
    differs: v.key(a, traceA) !== v.key(b, traceB),
    renderA: v.render(a, traceA),
    renderB: v.render(b, traceB),
  }));
  const differing = rows.filter((r) => r.controlled && r.differs);
  return (
    <Section title="Variables">
      {differing.length === 0 ? (
        <Banner tone="info">
          Configurations identiques : les écarts mesurés reflètent la variance d'un run à l'autre.
        </Banner>
      ) : differing.length === 1 ? (
        <Banner tone="success">
          Comparaison contrôlée : seule la variable « {differing[0].label} » change, les autres sont constantes.
        </Banner>
      ) : (
        <Banner tone="warning">
          {differing.length} variables diffèrent ({differing.map((r) => r.label).join(", ")}) : un écart de résultat ne
          peut pas être attribué à une seule d'entre elles.
        </Banner>
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Variable</TableHead>
              <TableHead>Session A</TableHead>
              <TableHead>Session B</TableHead>
              <TableHead className="w-24 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label} className={cn(r.differs && r.controlled && "bg-warning/5")}>
                <TableCell className="text-muted-foreground">
                  {r.label}
                  {!r.controlled && <div className="text-[11px] opacity-70">informatif</div>}
                </TableCell>
                <TableCell className="truncate">{r.renderA}</TableCell>
                <TableCell className="truncate">{r.renderB}</TableCell>
                <TableCell className="text-right">
                  {r.differs ? (
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[11px] font-medium",
                        r.controlled
                          ? "border-warning/40 bg-warning/10 text-warning"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      diffère
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">identique</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

export function Banner({ tone, children }: { tone: "info" | "success" | "warning"; children: ReactNode }) {
  const Icon = tone === "warning" ? AlertTriangle : CheckCircle2;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm",
        tone === "success" && "border-success/35 bg-success/10 text-success",
        tone === "warning" && "border-warning/40 bg-warning/10 text-warning",
        tone === "info" && "border-info/35 bg-info/10 text-info",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
