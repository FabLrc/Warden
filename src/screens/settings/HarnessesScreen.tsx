import { AlertTriangle, ArrowUpCircle, RefreshCw, Terminal } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CompatBadge, SupportBadge } from "@/components/warden/badges";
import { KeyValue, Page, Section } from "@/components/warden/page";
import { INTEGRATION_LABELS, SUPPORT_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { CAPABILITY_LABELS, harnesses, providers } from "@/mock/fixtures/catalog";
import { checkProvider, getHarness } from "@/mock/queries";
import type { CapabilityId, Harness, HarnessId, HarnessStatus } from "@/mock/types";
import { HARNESS_STATUS_LABELS } from "./shared";

const STATUS_CLASSES: Record<HarnessStatus, string> = {
  available: "text-success",
  outdated: "text-warning",
  "not-installed": "text-muted-foreground",
  error: "text-destructive",
};

const STATUS_DOT: Record<HarnessStatus, string> = {
  available: "bg-success",
  outdated: "bg-warning",
  "not-installed": "bg-muted-foreground/50",
  error: "bg-destructive",
};

const CAPABILITY_IDS = Object.keys(CAPABILITY_LABELS) as CapabilityId[];

/** Simulated actions: the prototype never runs a command, it only reflects the click in the UI. */
interface LocalActions {
  rechecked: Partial<Record<HarnessId, boolean>>;
  updateRequested: Partial<Record<HarnessId, boolean>>;
}

export function HarnessesScreen() {
  const [selectedId, setSelectedId] = useState<HarnessId>(harnesses[0].id);
  const [actions, setActions] = useState<LocalActions>({ rechecked: {}, updateRequested: {} });
  const selected = getHarness(selectedId);

  const recheck = (id: HarnessId) => setActions((a) => ({ ...a, rechecked: { ...a.rechecked, [id]: true } }));
  const requestUpdate = (id: HarnessId) =>
    setActions((a) => ({ ...a, updateRequested: { ...a.updateRequested, [id]: true } }));

  return (
    <Page
      title="Harnesses"
      subtitle="Agents de code détectés sur cette machine, leurs capacités et leurs limites (CDC §10)."
      inspectorTitle={selected.name}
      inspector={
        <HarnessDetail
          harness={selected}
          rechecked={actions.rechecked[selected.id] === true}
          updateRequested={actions.updateRequested[selected.id] === true}
          onRecheck={() => recheck(selected.id)}
          onUpdate={() => requestUpdate(selected.id)}
        />
      }
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setActions((a) => ({
              ...a,
              rechecked: Object.fromEntries(harnesses.map((h) => [h.id, true])) as LocalActions["rechecked"],
            }))
          }
        >
          <RefreshCw />
          Tout vérifier à nouveau
        </Button>
      }
    >
      <div className="space-y-8">
        <Section title="Harnesses détectés">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {harnesses.map((h) => (
              <HarnessCard
                key={h.id}
                harness={h}
                selected={h.id === selectedId}
                rechecked={actions.rechecked[h.id] === true}
                onSelect={() => setSelectedId(h.id)}
              />
            ))}
          </div>
        </Section>

        <Section
          title="Matrice des capacités"
          actions={
            <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {(["supported", "partial", "unsupported", "unknown"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <SupportBadge support={s} compact note={SUPPORT_LABELS[s]} />
                  {SUPPORT_LABELS[s]}
                </span>
              ))}
            </span>
          }
        >
          <CapabilityMatrix selectedId={selectedId} onSelect={setSelectedId} />
          <p className="text-xs text-muted-foreground">
            Survolez une cellule pour lire la précision. « Inconnu » signifie que Warden n'a pas pu le vérifier : ce
            n'est jamais traité comme « Supporté ».
          </p>
        </Section>
      </div>
    </Page>
  );
}

function HarnessCard({
  harness: h,
  selected,
  rechecked,
  onSelect,
}: {
  harness: Harness;
  selected: boolean;
  rechecked: boolean;
  onSelect: () => void;
}) {
  const gaps = CAPABILITY_IDS.filter((c) => h.capabilities[c].support === "unsupported");
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected ? "border-primary/50 bg-primary/5 glow-soul" : "border-border bg-card hover:bg-accent",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{h.name}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{h.command}</div>
        </div>
        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", STATUS_CLASSES[h.status])}>
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[h.status])} />
          {HARNESS_STATUS_LABELS[h.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-muted-foreground">Version</span>
        <span className="tabular-nums">
          {h.version ?? "—"}
          {h.latestVersion && h.version !== h.latestVersion && (
            <span className="text-warning"> → {h.latestVersion}</span>
          )}
        </span>
        <span className="text-muted-foreground">Intégration</span>
        <span>
          {INTEGRATION_LABELS[h.integration]}
          {h.adapter && <span className="font-mono text-muted-foreground"> · {h.adapter}</span>}
        </span>
      </div>

      {h.statusDetail && (
        <div
          className={cn(
            "flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs",
            h.status === "outdated" ? "border-warning/30 bg-warning/10 text-warning" : "border-border bg-muted/40",
          )}
        >
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          {h.statusDetail}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>
          {gaps.length === 0
            ? "Aucune capacité non supportée"
            : `Non supporté : ${gaps.map((c) => CAPABILITY_LABELS[c]).join(", ")}`}
        </span>
        {rechecked && <span className="shrink-0 text-primary">Vérifié (simulé)</span>}
      </div>
    </button>
  );
}

function CapabilityMatrix({ selectedId, onSelect }: { selectedId: HarnessId; onSelect: (id: HarnessId) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Capacité</th>
            {harnesses.map((h) => (
              <th key={h.id} className={cn("px-2 py-2 text-center", h.id === selectedId && "bg-primary/10")}>
                <button
                  type="button"
                  onClick={() => onSelect(h.id)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-medium hover:bg-accent",
                    h.id === selectedId ? "text-primary" : "text-foreground",
                  )}
                >
                  {h.name}
                </button>
                {!h.installed && <div className="text-[10px] font-normal text-muted-foreground">non installé</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {CAPABILITY_IDS.map((cap) => (
            <tr key={cap} className="border-b border-border last:border-0 hover:bg-accent/40">
              <td className="px-3 py-1.5 text-xs">{CAPABILITY_LABELS[cap]}</td>
              {harnesses.map((h) => {
                const c = h.capabilities[cap];
                return (
                  <td key={h.id} className={cn("px-2 py-1.5 text-center", h.id === selectedId && "bg-primary/10")}>
                    <SupportBadge
                      support={c.support}
                      compact
                      note={`${h.name} · ${CAPABILITY_LABELS[cap]} : ${SUPPORT_LABELS[c.support]}${c.note ? ` — ${c.note}` : ""}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HarnessDetail({
  harness: h,
  rechecked,
  updateRequested,
  onRecheck,
  onUpdate,
}: {
  harness: Harness;
  rechecked: boolean;
  updateRequested: boolean;
  onRecheck: () => void;
  onUpdate: () => void;
}) {
  const limited = CAPABILITY_IDS.filter((c) => h.capabilities[c].support !== "supported");
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <KeyValue label="Statut">
          <span className={cn("font-medium", STATUS_CLASSES[h.status])}>{HARNESS_STATUS_LABELS[h.status]}</span>
        </KeyValue>
        <KeyValue label="Installé">{h.installed ? "Oui" : "Non"}</KeyValue>
        <KeyValue label="Version">
          <span className="tabular-nums">{h.version ?? "—"}</span>
        </KeyValue>
        <KeyValue label="Dernière version">
          <span className="tabular-nums">{h.latestVersion ?? "—"}</span>
        </KeyValue>
        <KeyValue label="Intégration">{INTEGRATION_LABELS[h.integration]}</KeyValue>
        {h.adapter && (
          <KeyValue label="Adaptateur">
            <span className="font-mono text-xs">{h.adapter}</span>
          </KeyValue>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">Commande</div>
        <code className="flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
          <Terminal className="size-3 shrink-0 text-muted-foreground" />
          {h.command}
        </code>
      </div>

      {h.statusDetail && (
        <Alert className={h.status === "outdated" ? "border-warning/40" : undefined}>
          <AlertTriangle className={h.status === "outdated" ? "text-warning" : undefined} />
          <AlertTitle>{HARNESS_STATUS_LABELS[h.status]}</AlertTitle>
          <AlertDescription>{h.statusDetail}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRecheck}>
            <RefreshCw />
            Vérifier à nouveau
          </Button>
          {h.status === "outdated" && (
            <Button size="sm" onClick={onUpdate} disabled={updateRequested}>
              <ArrowUpCircle />
              Mettre à jour l'adaptateur
            </Button>
          )}
        </div>
        {rechecked && (
          <p className="text-[11px] text-muted-foreground">
            Vérification simulée : la maquette n'exécute aucune commande, l'état affiché reste celui des données de
            démonstration.
          </p>
        )}
        {updateRequested && (
          <p className="text-[11px] text-muted-foreground">
            Mise à jour simulée : dans le vrai produit, Warden lancerait la mise à jour de {h.adapter} puis
            revérifierait les capacités. Rien n'a été installé.
          </p>
        )}
        {!h.installed && (
          <p className="text-[11px] text-muted-foreground">
            Installez {h.name} pour que la commande <code className="font-mono">{h.command}</code> soit disponible, puis
            relancez la vérification.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Limitations</div>
        <ul className="list-disc space-y-1 pl-4 text-xs">
          {h.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Fonctionnalités Warden limitées avec {h.name}</div>
        {limited.length === 0 ? (
          <p className="text-xs text-muted-foreground">Toutes les capacités connues sont supportées.</p>
        ) : (
          <ul className="space-y-2">
            {limited.map((cap) => {
              const c = h.capabilities[cap];
              return (
                <li key={cap} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span>{CAPABILITY_LABELS[cap]}</span>
                    <SupportBadge support={c.support} />
                  </div>
                  {c.note && <p className="text-[11px] text-muted-foreground">{c.note}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Providers</span>
          <Link to={links.models()} className="text-[11px] text-primary hover:underline">
            Détail des modèles
          </Link>
        </div>
        <div className="space-y-1">
          {providers.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
              <span>{p.name}</span>
              <CompatBadge verdict={checkProvider(h.id, p.id)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
