import { Download, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Markdown } from "@/components/warden/markdown";
import { ObservedValue } from "@/components/warden/observation";
import { EmptyState, Page, Section } from "@/components/warden/page";
import { formatDateTime, formatTokens } from "@/lib/format";
import { SUPPORT_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { harnesses, MOCK_NOW } from "@/mock/fixtures/catalog";
import { agents, profiles, skills as skillFixtures } from "@/mock/fixtures/workspace";
import { getHarness } from "@/mock/queries";
import type { CapabilitySupport, HarnessId, Observation, Skill } from "@/mock/types";
import {
  Field,
  HarnessCompatStrip,
  HarnessCompatTable,
  ListItem,
  LocalStateNote,
  ScopeChip,
  ScopeEditor,
  scopeLabel,
} from "./shared";

type ScopeFilter = "all" | "global" | "project";
type EnabledFilter = "all" | "enabled" | "disabled";

const NEW_SKILL_CONTENT = "# Nouveau skill\n\nDécrivez ici, en Markdown, ce que l'agent doit savoir ou appliquer.\n";

/** Draft skills have no tokenizer pass yet: a rough length-based estimate, labelled as such. */
const draftTokenEstimate = (content: string): Observation<number> => ({
  value: Math.max(1, Math.round(content.length / 4)),
  confidence: "estimated",
  source: "approximation (≈ 4 caractères par token)",
  note: "Recalculé à chaque modification du contenu",
});

export function SkillsScreen() {
  const [items, setItems] = useState<Skill[]>(skillFixtures);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string>(skillFixtures[0].id);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [enabledFilter, setEnabledFilter] = useState<EnabledFilter>("all");

  const visible = items.filter(
    (s) =>
      (scopeFilter === "all" || s.scope.kind === scopeFilter) &&
      (enabledFilter === "all" || s.enabled === (enabledFilter === "enabled")),
  );
  const selected = items.find((s) => s.id === selectedId);

  const update = (id: string, patch: Partial<Skill>) =>
    setItems((list) =>
      list.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...patch, updatedAt: MOCK_NOW.toISOString() };
        return patch.content !== undefined && draftIds.includes(id)
          ? { ...next, tokenEstimate: draftTokenEstimate(patch.content) }
          : next;
      }),
    );

  const create = () => {
    const id = `skill-${Date.now().toString(36)}`;
    const skill: Skill = {
      id,
      name: "nouveau-skill",
      description: "",
      content: NEW_SKILL_CONTENT,
      /* A new Warden skill inherits each harness's generic "Skills Warden" capability until it is tested. */
      compat: Object.fromEntries(
        harnesses.map((h) => [
          h.id,
          {
            support: h.capabilities.skills.support,
            note: `Déduit de la capacité Skills de ${h.name}${h.capabilities.skills.note ? ` : ${h.capabilities.skills.note}` : ""}`,
          },
        ]),
      ) as Record<HarnessId, CapabilitySupport>,
      scope: { kind: "global" },
      origin: { kind: "warden" },
      enabled: true,
      tokenEstimate: draftTokenEstimate(NEW_SKILL_CONTENT),
      updatedAt: MOCK_NOW.toISOString(),
    };
    setItems((list) => [skill, ...list]);
    setDraftIds((ids) => [...ids, id]);
    setScopeFilter("all");
    setEnabledFilter("all");
    setSelectedId(id);
  };

  return (
    <Page
      title="Skills"
      subtitle="Bibliothèque de skills Warden : portée, origine, coût en contexte et compatibilité par harness (CDC §13)."
      bodyClassName="p-0 overflow-hidden"
      actions={
        <Button size="sm" onClick={create}>
          <Plus />
          Nouveau skill
        </Button>
      }
    >
      <div className="flex h-full min-h-0">
        <div className="flex w-[26rem] shrink-0 flex-col border-r border-border">
          <div className="space-y-2 border-b border-border p-3">
            <div className="flex items-center gap-2">
              <span className="w-14 text-[11px] text-muted-foreground">Portée</span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                spacing={0}
                value={scopeFilter}
                onValueChange={(v) => v && setScopeFilter(v as ScopeFilter)}
              >
                <ToggleGroupItem value="all">Tous</ToggleGroupItem>
                <ToggleGroupItem value="global">Global</ToggleGroupItem>
                <ToggleGroupItem value="project">Projet</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-[11px] text-muted-foreground">État</span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                spacing={0}
                value={enabledFilter}
                onValueChange={(v) => v && setEnabledFilter(v as EnabledFilter)}
              >
                <ToggleGroupItem value="all">Tous</ToggleGroupItem>
                <ToggleGroupItem value="enabled">Activés</ToggleGroupItem>
                <ToggleGroupItem value="disabled">Désactivés</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-auto p-3">
            {visible.length === 0 ? (
              <EmptyState icon={<FileText />} title="Aucun skill ne correspond aux filtres" />
            ) : (
              visible.map((s) => (
                <ListItem key={s.id} selected={s.id === selectedId} onSelect={() => setSelectedId(s.id)}>
                  <SkillRow skill={s} onToggle={(enabled) => update(s.id, { enabled })} />
                </ListItem>
              ))
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 overflow-auto bg-sculk p-6">
          {selected ? (
            <SkillDetail
              key={selected.id}
              skill={selected}
              isDraft={draftIds.includes(selected.id)}
              onChange={(patch) => update(selected.id, patch)}
            />
          ) : (
            <EmptyState icon={<FileText />} title="Sélectionnez un skill" />
          )}
        </div>
      </div>
    </Page>
  );
}

function OriginChip({ origin }: { origin: Skill["origin"] }) {
  return (
    <span
      className="inline-flex h-5 items-center gap-1 rounded border border-border bg-secondary/60 px-1.5 text-[11px] text-muted-foreground"
      title={origin.kind === "imported" ? `Importé depuis ${origin.from}` : "Créé dans Warden"}
    >
      {origin.kind === "imported" && <Download className="size-3" />}
      {origin.kind === "imported" ? "Importé" : "Warden"}
    </span>
  );
}

function SkillRow({ skill: s, onToggle }: { skill: Skill; onToggle: (enabled: boolean) => void }) {
  return (
    <div className={s.enabled ? "space-y-2" : "space-y-2 opacity-60"}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-sm font-medium">{s.name}</div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{s.description || "Sans description"}</p>
        </div>
        <Switch
          size="sm"
          checked={s.enabled}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          aria-label={s.enabled ? `Désactiver ${s.name}` : `Activer ${s.name}`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ScopeChip scope={s.scope} />
        <OriginChip origin={s.origin} />
        <ObservedValue obs={s.tokenEstimate} format={(n) => `${formatTokens(n)} tokens`} className="text-xs" />
      </div>
      <HarnessCompatStrip compat={s.compat} />
    </div>
  );
}

function SkillDetail({
  skill: s,
  isDraft,
  onChange,
}: {
  skill: Skill;
  isDraft: boolean;
  onChange: (patch: Partial<Skill>) => void;
}) {
  const usedByProfiles = profiles.filter((p) => p.skillIds.includes(s.id));
  const usedByAgents = agents.filter((a) => a.skillIds.includes(s.id));
  const incompatible = harnesses.filter((h) => s.compat[h.id].support === "unsupported");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            value={s.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="h-9 max-w-xs font-mono text-base font-medium"
            aria-label="Nom du skill"
          />
          <Label className="font-normal">
            <Switch checked={s.enabled} onCheckedChange={(enabled) => onChange({ enabled })} />
            {s.enabled ? "Activé" : "Désactivé"}
          </Label>
          <OriginChip origin={s.origin} />
          <span className="text-[11px] text-muted-foreground">Modifié {formatDateTime(s.updatedAt)}</span>
        </div>
        <Input
          value={s.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Description courte : quand ce skill est utile"
          aria-label="Description"
        />
        {s.origin.kind === "imported" && (
          <p className="text-xs text-muted-foreground">
            Importé depuis <code className="font-mono text-foreground/90">{s.origin.from}</code>
          </p>
        )}
        {!s.enabled && (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Désactivé : ce skill n'est chargé dans aucune session, quelle que soit sa portée.
          </p>
        )}
        <LocalStateNote />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Portée">
          <div className="rounded-lg border border-border bg-card p-3">
            <ScopeEditor value={s.scope} onChange={(scope) => onChange({ scope })} />
          </div>
          <p className="text-xs text-muted-foreground">
            {s.enabled ? `Chargé : ${scopeLabel(s.scope).toLowerCase()}.` : "Portée conservée, mais skill désactivé."}
          </p>
        </Section>

        <Section title="Coût en contexte">
          <div className="space-y-2 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted-foreground">Taille chargée dans le contexte</span>
              <ObservedValue obs={s.tokenEstimate} format={(n) => `${formatTokens(n)} tokens`} />
            </div>
            <p className="text-xs text-muted-foreground">
              Un skill chargé occupe du contexte à chaque appel modèle de la session : il doit justifier ce coût.
              {isDraft && " Estimation grossière tant que le skill n'est pas passé au tokenizer."}
            </p>
            {(usedByProfiles.length > 0 || usedByAgents.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-2 text-xs">
                <span className="text-muted-foreground">Utilisé par</span>
                {usedByProfiles.map((p) => (
                  <Link
                    key={p.id}
                    to={links.profiles()}
                    className="rounded border border-border px-1.5 hover:text-primary"
                  >
                    Profil {p.name}
                  </Link>
                ))}
                {usedByAgents.map((a) => (
                  <Link
                    key={a.id}
                    to={links.agents()}
                    className="rounded border border-border px-1.5 hover:text-primary"
                  >
                    Agent {a.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Section>
      </div>

      <Section
        title="Compatibilité par harness"
        actions={
          incompatible.length > 0 && (
            <span className="text-xs text-destructive">
              Inutilisable avec {incompatible.map((h) => h.name).join(", ")}
            </span>
          )
        }
      >
        <HarnessCompatTable
          compat={s.compat}
          footnote={(harnessId) => {
            const cap = getHarness(harnessId).capabilities.skills;
            return `Skills Warden : ${SUPPORT_LABELS[cap.support].toLowerCase()}${cap.note ? ` — ${cap.note}` : ""}`;
          }}
        />
      </Section>

      <Section title="Contenu">
        <div className="grid gap-4 xl:grid-cols-2">
          <Field label="Markdown">
            <Textarea
              value={s.content}
              onChange={(e) => onChange({ content: e.target.value })}
              className="min-h-72 font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
          </Field>
          <Field label="Aperçu">
            <div className="min-h-72 rounded-lg border border-border bg-card p-4">
              <Markdown>{s.content}</Markdown>
            </div>
          </Field>
        </div>
      </Section>
    </div>
  );
}
