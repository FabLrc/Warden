import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SupportBadge } from "@/components/warden/badges";
import { SUPPORT_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { harnesses } from "@/mock/fixtures/catalog";
import { projects } from "@/mock/fixtures/workspace";
import type { CapabilitySupport, HarnessId, HarnessStatus, Scope } from "@/mock/types";

export const HARNESS_STATUS_LABELS: Record<HarnessStatus, string> = {
  available: "Disponible",
  outdated: "Mise à jour disponible",
  "not-installed": "Non installé",
  error: "Erreur",
};

/** "Global" or "Projet : atlas-api, warden". */
export function scopeLabel(scope: Scope): string {
  if (scope.kind === "global") return "Global";
  if (scope.projectIds.length === 0) return "Aucun projet";
  const names = scope.projectIds.map((id) => projects.find((p) => p.id === id)?.name ?? id);
  return `${names.length > 1 ? "Projets" : "Projet"} : ${names.join(", ")}`;
}

export function ScopeChip({ scope }: { scope: Scope }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border px-1.5 text-[11px]",
        scope.kind === "global"
          ? "border-border bg-secondary/60 text-muted-foreground"
          : "border-primary/30 bg-primary/10 text-primary",
      )}
    >
      {scopeLabel(scope)}
    </span>
  );
}

/** Global vs. a selection of projects (CDC §12, §13). */
export function ScopeEditor({ value, onChange }: { value: Scope; onChange: (scope: Scope) => void }) {
  const selected = value.kind === "project" ? value.projectIds : [];
  const toggleProject = (id: string, checked: boolean) =>
    onChange({
      kind: "project",
      projectIds: checked ? [...selected, id] : selected.filter((p) => p !== id),
    });
  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={value.kind}
        onValueChange={(kind) => {
          if (kind === "global") onChange({ kind: "global" });
          else if (kind === "project") onChange({ kind: "project", projectIds: selected });
        }}
      >
        <ToggleGroupItem value="global">Global</ToggleGroupItem>
        <ToggleGroupItem value="project">Projets choisis</ToggleGroupItem>
      </ToggleGroup>
      {value.kind === "global" ? (
        <p className="text-xs text-muted-foreground">Disponible dans tous les projets.</p>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <Label key={p.id} className="font-normal">
              <Checkbox
                checked={selected.includes(p.id)}
                onCheckedChange={(checked) => toggleProject(p.id, checked === true)}
              />
              <span className="font-mono text-xs">{p.name}</span>
              <span className="truncate text-xs text-muted-foreground">{p.path}</span>
            </Label>
          ))}
          {selected.length === 0 && (
            <p className="text-xs text-warning">
              Choisissez au moins un projet, sinon l'élément ne sera chargé nulle part.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** One compact icon per harness, with the harness name in the tooltip. */
export function HarnessCompatStrip({ compat }: { compat: Record<HarnessId, CapabilitySupport> }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {harnesses.map((h) => {
        const c = compat[h.id];
        return (
          <span key={h.id} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            {h.name}
            <SupportBadge
              support={c.support}
              compact
              note={`${h.name} : ${SUPPORT_LABELS[c.support]}${c.note ? ` — ${c.note}` : ""}`}
            />
          </span>
        );
      })}
    </span>
  );
}

/** Per-harness support with the explanation spelled out (no tooltip needed). */
export function HarnessCompatTable({
  compat,
  footnote,
}: {
  compat: Record<HarnessId, CapabilitySupport>;
  /** Extra per-harness context, e.g. the harness capability behind the verdict. */
  footnote?: (harnessId: HarnessId) => ReactNode;
}) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-card">
      {harnesses.map((h) => {
        const c = compat[h.id];
        const extra = footnote?.(h.id);
        return (
          <div key={h.id} className="grid grid-cols-[7rem_auto_1fr] items-start gap-3 px-3 py-2 text-sm">
            <span className="font-medium">
              {h.name}
              {!h.installed && (
                <span className="block text-[10px] font-normal text-muted-foreground">non installé</span>
              )}
            </span>
            <SupportBadge support={c.support} />
            <div className="min-w-0 space-y-0.5 text-xs">
              <div className={c.note ? "text-foreground/90" : "text-muted-foreground"}>
                {c.note ?? (c.support === "unknown" ? "Jamais vérifié avec ce harness." : "Aucune remarque.")}
              </div>
              {extra && <div className="text-muted-foreground">{extra}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Honest reminder that edits only live in the mock-up. */
export function LocalStateNote({ children }: { children?: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Info className="size-3 shrink-0" />
      {children ?? "Maquette : les modifications restent locales à cet écran et ne sont pas enregistrées."}
    </p>
  );
}

/** Selectable row for list/detail layouts. */
export function ListItem({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: the row hosts nested interactive controls (switches).
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-pressed={selected}
      className={cn(
        "block w-full cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected ? "border-primary/50 bg-primary/5 glow-soul" : "border-border bg-card hover:bg-accent",
      )}
    >
      {children}
    </div>
  );
}
