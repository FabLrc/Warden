import { Check, CircleHelp, FlaskConical, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CompatBadge, SupportBadge } from "@/components/warden/badges";
import { ConfigPicker, type PickerValue } from "@/components/warden/config-picker";
import { Page, Section } from "@/components/warden/page";
import { formatCost, formatTokens } from "@/lib/format";
import { MODEL_TIER_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { compatibilityRules, harnesses, models, providers } from "@/mock/fixtures/catalog";
import type { CompatibilityStatus } from "@/mock/queries";
import { checkCombination, checkProvider, getHarness, getModel, getProvider, modelsForProvider } from "@/mock/queries";
import type { HarnessId, Provider } from "@/mock/types";

const PROVIDER_KIND_LABELS: Record<Provider["kind"], string> = {
  cloud: "Cloud",
  local: "Local",
  router: "Routeur",
};

const VERDICT_CONSEQUENCE: Record<CompatibilityStatus, string> = {
  supported: "Combinaison vérifiée : utilisable sans réserve connue.",
  partial: "Utilisable, mais avec des limites connues. Elles seront rappelées au lancement de la session.",
  unsupported: "Combinaison impossible : Warden ne la proposera pas au lancement d'une session.",
  unknown: "Jamais vérifiée : Warden ne la présente pas comme supportée. Elle pourra être tentée, à vos risques.",
};

const VERDICT_TITLE: Record<CompatibilityStatus, string> = {
  supported: "Compatible",
  partial: "Compatible avec limites",
  unsupported: "Incompatible",
  unknown: "Compatibilité inconnue",
};

const PRESETS: { label: string; value: PickerValue }[] = [
  { label: "Claude Code + GPT-5", value: { harnessId: "claude-code", providerId: "openai", modelId: "gpt-5" } },
  {
    label: "OpenCode + Gemini Flash",
    value: { harnessId: "opencode", providerId: "google", modelId: "gemini-flash" },
  },
  { label: "OMP + Ollama", value: { harnessId: "omp", providerId: "ollama", modelId: "qwen3-coder" } },
  { label: "Codex + GPT-5 Codex", value: { harnessId: "codex", providerId: "openai", modelId: "gpt-5-codex" } },
];

const modelExceptions = compatibilityRules.filter((r) => r.modelId !== undefined);

export function ModelsScreen() {
  const [combo, setCombo] = useState<PickerValue>({
    harnessId: "opencode",
    providerId: "anthropic",
    modelId: "claude-sonnet",
  });

  return (
    <Page
      title="Providers et modèles"
      subtitle="Harness → Provider → Modèle : trois choix distincts, avec une compatibilité explicite (CDC §11)."
    >
      <div className="space-y-8">
        <Section title="Tester une combinaison">
          <CombinationTester value={combo} onChange={setCombo} />
        </Section>

        <Section title="Compatibilité harness × provider">
          <ProviderMatrix
            selected={combo}
            onPick={(harnessId, providerId) =>
              setCombo({ harnessId, providerId, modelId: modelsForProvider(providerId)[0]?.id ?? "" })
            }
          />
          <p className="text-xs text-muted-foreground">
            Cliquez sur une cellule pour la tester ci-dessus. Une case « Inconnu » n'est couverte par aucune règle :
            elle n'est jamais affichée comme supportée.
          </p>
        </Section>

        <Section title="Exceptions par modèle">
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {modelExceptions.map((r) => (
              <div key={`${r.harnessId}-${r.modelId}`} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                <span className="w-28 font-medium">{getHarness(r.harnessId).name}</span>
                <span className="w-48 text-xs">
                  <span className="text-muted-foreground">{getProvider(r.providerId).name} / </span>
                  {r.modelId && getModel(r.modelId).name}
                </span>
                <SupportBadge support={r.status} />
                <span className="flex-1 text-xs text-muted-foreground">{r.reason}</span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setCombo({ harnessId: r.harnessId, providerId: r.providerId, modelId: r.modelId ?? "" })
                  }
                >
                  <FlaskConical />
                  Tester
                </Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Une exception au niveau du modèle remplace la règle du provider pour ce harness.
          </p>
        </Section>

        <Section
          title="Catalogue"
          actions={
            <span className="text-[11px] text-muted-foreground">
              Prix catalogue en $ / million de tokens, utilisés pour les estimations de coût
            </span>
          }
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                onTest={(modelId) => setCombo({ ...combo, providerId: p.id, modelId })}
              />
            ))}
          </div>
        </Section>
      </div>
    </Page>
  );
}

function CombinationTester({ value, onChange }: { value: PickerValue; onChange: (v: PickerValue) => void }) {
  const verdict = checkCombination(value);
  const harness = getHarness(value.harnessId);
  const provider = getProvider(value.providerId);
  const model = models.find((m) => m.id === value.modelId);
  const providerRule = compatibilityRules.find(
    (r) => r.harnessId === value.harnessId && r.providerId === value.providerId && !r.modelId,
  );
  const modelRule = compatibilityRules.find(
    (r) => r.harnessId === value.harnessId && r.providerId === value.providerId && r.modelId === value.modelId,
  );
  const servedByProvider = model?.providerId === value.providerId;

  const steps: { ok: boolean | null; text: string }[] = [
    {
      ok: servedByProvider,
      text: servedByProvider
        ? `${model?.name} est servi par ${provider.name}.`
        : `${model?.name ?? "Ce modèle"} n'est pas servi par ${provider.name}.`,
    },
    providerRule
      ? {
          ok: providerRule.status !== "unsupported",
          text: `Règle ${harness.name} × ${provider.name} : ${VERDICT_TITLE[providerRule.status].toLowerCase()}${
            providerRule.reason ? ` — ${providerRule.reason}` : ""
          }.`,
        }
      : { ok: null, text: `Aucune règle pour ${harness.name} × ${provider.name} : combinaison jamais vérifiée.` },
    modelRule
      ? {
          ok: modelRule.status !== "unsupported",
          text: `Exception pour ${model?.name} : ${VERDICT_TITLE[modelRule.status].toLowerCase()}${
            modelRule.reason ? ` — ${modelRule.reason}` : ""
          }.`,
        }
      : { ok: true, text: `Pas d'exception spécifique à ${model?.name ?? "ce modèle"}.` },
    harness.installed
      ? { ok: true, text: `${harness.name} est installé.` }
      : { ok: false, text: `${harness.name} n'est pas installé : au mieux « partiel » tant qu'il est absent.` },
  ];

  const selectionNotes = [harness.capabilities.providerSelection, harness.capabilities.modelSelection]
    .map((c) => c.note)
    .filter((n): n is string => n !== undefined);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Exemples :</span>
        {PRESETS.map((p) => (
          <Button key={p.label} variant="secondary" size="xs" onClick={() => onChange(p.value)}>
            {p.label}
          </Button>
        ))}
      </div>

      <ConfigPicker value={value} onChange={onChange} showProfile={false} />

      <div
        className={cn(
          "grid gap-4 rounded-md border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]",
          verdict.status === "supported" && "border-success/30 bg-success/5",
          verdict.status === "partial" && "border-warning/30 bg-warning/5",
          verdict.status === "unsupported" && "border-destructive/30 bg-destructive/5",
          verdict.status === "unknown" && "border-border bg-muted/30",
        )}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CompatBadge verdict={verdict} />
            <span className="font-semibold">{VERDICT_TITLE[verdict.status]}</span>
          </div>
          {verdict.reason && <p className="text-sm">{verdict.reason}</p>}
          <p className="text-xs text-muted-foreground">{VERDICT_CONSEQUENCE[verdict.status]}</p>
          {selectionNotes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {harness.name} : {selectionNotes.join(" · ")}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Comment ce verdict est obtenu</div>
          <ol className="space-y-1">
            {steps.map((s) => (
              <li key={s.text} className="flex items-start gap-2 text-xs">
                {s.ok === null ? (
                  <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                ) : s.ok ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-success" />
                ) : (
                  <X className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                )}
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function ProviderMatrix({
  selected,
  onPick,
}: {
  selected: PickerValue;
  onPick: (harnessId: HarnessId, providerId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Harness \ Provider</th>
            {providers.map((p) => (
              <th key={p.id} className="px-2 py-2 text-left text-xs font-medium">
                {p.name}
                <span className="ml-1 font-normal text-muted-foreground">{PROVIDER_KIND_LABELS[p.kind]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {harnesses.map((h) => (
            <tr key={h.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2 text-xs font-medium">
                {h.name}
                {!h.installed && (
                  <span className="block text-[10px] font-normal text-muted-foreground">non installé</span>
                )}
              </td>
              {providers.map((p) => {
                const isSelected = selected.harnessId === h.id && selected.providerId === p.id;
                return (
                  <td key={p.id} className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => onPick(h.id, p.id)}
                      aria-pressed={isSelected}
                      aria-label={`Tester ${h.name} avec ${p.name}`}
                      className={cn(
                        "rounded-md px-1.5 py-1 hover:bg-accent",
                        isSelected && "bg-primary/10 ring-1 ring-primary/50",
                      )}
                    >
                      <CompatBadge verdict={checkProvider(h.id, p.id)} />
                    </button>
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

function ProviderCard({ provider: p, onTest }: { provider: Provider; onTest: (modelId: string) => void }) {
  const providerModels = modelsForProvider(p.id);
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="font-semibold">{p.name}</span>
        <span className="rounded border border-border bg-secondary/60 px-1.5 text-[11px] text-muted-foreground">
          {PROVIDER_KIND_LABELS[p.kind]}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] text-muted-foreground">
            <th className="px-4 py-1.5 text-left font-medium">Modèle</th>
            <th className="px-2 py-1.5 text-left font-medium">Gamme</th>
            <th className="px-2 py-1.5 text-right font-medium">Contexte</th>
            <th className="px-2 py-1.5 text-right font-medium">Entrée</th>
            <th className="px-2 py-1.5 text-right font-medium">Sortie</th>
            <th className="px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {providerModels.map((m) => (
            <tr key={m.id} className="border-b border-border last:border-0">
              <td className="px-4 py-1.5 font-medium">{m.name}</td>
              <td className="px-2 py-1.5 text-xs text-muted-foreground">{MODEL_TIER_LABELS[m.tier]}</td>
              <td className="px-2 py-1.5 text-right text-xs tabular-nums">{formatTokens(m.contextWindow)}</td>
              <td className="px-2 py-1.5 text-right text-xs tabular-nums">
                {m.inputPricePerMTok === undefined ? <NoPrice /> : formatCost(m.inputPricePerMTok)}
              </td>
              <td className="px-2 py-1.5 text-right text-xs tabular-nums">
                {m.outputPricePerMTok === undefined ? <NoPrice /> : formatCost(m.outputPricePerMTok)}
              </td>
              <td className="px-2 py-1.5 text-right">
                <Button variant="ghost" size="icon-xs" onClick={() => onTest(m.id)} aria-label={`Tester ${m.name}`}>
                  <FlaskConical />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NoPrice() {
  return (
    <span className="text-muted-foreground" title="Aucun prix catalogue (modèle local) : coût non estimable">
      —
    </span>
  );
}
