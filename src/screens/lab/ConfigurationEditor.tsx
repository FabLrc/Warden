import { Copy, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SupportBadge } from "@/components/warden/badges";
import { ConfigPicker } from "@/components/warden/config-picker";
import { cn } from "@/lib/utils";
import { WARDEN_FEATURE_IDS, WARDEN_FEATURE_LABELS } from "@/mock/fixtures/lab";
import { agents } from "@/mock/fixtures/workspace";
import { getAgent, skillsForProject } from "@/mock/queries";
import type { LabConfiguration } from "@/mock/types";
import type { Dimension } from "@/screens/lab/reproducibility";

const NO_AGENT = "__none__";

/**
 * One configuration of an experiment. The field matching the studied variable is highlighted;
 * fields that differ from the other configurations without being the variable are flagged.
 */
export function ConfigurationEditor({
  config,
  projectId,
  studied,
  confounders,
  canRemove,
  onChange,
  onDuplicate,
  onRemove,
}: {
  config: LabConfiguration;
  projectId: string;
  studied: Dimension;
  confounders: Dimension[];
  canRemove: boolean;
  onChange: (config: LabConfiguration) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const agent = config.agentId ? getAgent(config.agentId) : undefined;
  const agentSupport = agent?.compat[config.harnessId];
  const fieldProps = (dims: Dimension[]) => ({
    studied: dims.includes(studied),
    confounder: dims.some((d) => d !== studied && confounders.includes(d)),
  });

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Input
          value={config.label}
          onChange={(ev) => onChange({ ...config, label: ev.target.value })}
          className="h-7 max-w-64 font-medium"
          aria-label="Nom de la configuration"
        />
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={onDuplicate} title="Dupliquer pour ne changer que la variable">
            <Copy />
            Dupliquer
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onRemove}
            disabled={!canRemove}
            aria-label="Supprimer la configuration"
            title="Supprimer la configuration"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <div className="space-y-1 p-2">
        <Field label="Harness · Provider · Modèle" {...fieldProps(["harness", "model"])}>
          <ConfigPicker
            value={{ harnessId: config.harnessId, providerId: config.providerId, modelId: config.modelId }}
            onChange={({ harnessId, providerId, modelId }) => onChange({ ...config, harnessId, providerId, modelId })}
            projectId={projectId}
            showProfile={false}
          />
        </Field>

        <Field label="Agent" {...fieldProps(["agent"])}>
          <div className="flex items-center gap-2">
            <Select
              value={config.agentId ?? NO_AGENT}
              onValueChange={(id) => onChange({ ...config, agentId: id === NO_AGENT ? undefined : id })}
            >
              <SelectTrigger size="sm" className="min-w-40" aria-label="Agent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_AGENT}>Aucun</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agentSupport && agentSupport.support !== "supported" && (
              <SupportBadge support={agentSupport.support} note={agentSupport.note} />
            )}
          </div>
        </Field>

        <Field label="Skills" {...fieldProps(["skills"])}>
          <div className="flex flex-wrap gap-1.5">
            {skillsForProject(projectId).map((s) => {
              const active = config.skillIds.includes(s.id);
              const support = s.compat[config.harnessId];
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({
                      ...config,
                      skillIds: active ? config.skillIds.filter((id) => id !== s.id) : [...config.skillIds, s.id],
                    })
                  }
                  className={cn(
                    "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 font-mono text-xs transition-colors",
                    active
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {s.name}
                  {active && support.support !== "supported" && (
                    <SupportBadge support={support.support} note={support.note} compact />
                  )}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Fonctionnalités Warden" {...fieldProps(["features"])}>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {WARDEN_FEATURE_IDS.map((id) => (
              <div key={id} className="flex items-center gap-2 text-xs">
                <Switch
                  id={`${config.id}-feature-${id}`}
                  size="sm"
                  checked={config.features[id] ?? false}
                  onCheckedChange={(on) => onChange({ ...config, features: { ...config.features, [id]: on } })}
                />
                <label htmlFor={`${config.id}-feature-${id}`}>{WARDEN_FEATURE_LABELS[id]}</label>
              </div>
            ))}
          </div>
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  studied,
  confounder,
  children,
}: {
  label: string;
  studied: boolean;
  confounder: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-1.5 rounded-md border-l-2 border-transparent px-2 py-1.5 md:grid-cols-[11rem_minmax(0,1fr)] md:items-center",
        studied && "border-primary bg-primary/8",
        confounder && "border-warning bg-warning/8",
      )}
    >
      <div className="text-xs">
        <span className={cn("text-muted-foreground", studied && "text-primary")}>{label}</span>
        {studied && <span className="block text-[10px] uppercase tracking-wide text-primary/80">variable étudiée</span>}
        {confounder && (
          <span className="block text-[10px] uppercase tracking-wide text-warning">diffère hors variable</span>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
