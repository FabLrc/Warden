import { Bot, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CompatBadge, SupportBadge } from "@/components/warden/badges";
import { EmptyState, Page, Section } from "@/components/warden/page";
import { SUPPORT_LABELS } from "@/lib/labels";
import { harnesses, providers } from "@/mock/fixtures/catalog";
import { agents as agentFixtures, skills } from "@/mock/fixtures/workspace";
import { checkCombination, getHarness, getModel, modelsForProvider } from "@/mock/queries";
import type { Agent, CapabilitySupport, HarnessId } from "@/mock/types";
import { PermissionPolicyEditor } from "./agent-permissions";
import { Field, HarnessCompatStrip, HarnessCompatTable, ListItem, LocalStateNote } from "./shared";

const NO_MODEL = "__none__";

const TOOLS: Record<string, { label: string; description: string }> = {
  read: { label: "Lecture", description: "Lire des fichiers" },
  edit: { label: "Édition", description: "Modifier des fichiers" },
  grep: { label: "Recherche", description: "Chercher dans le code" },
  shell: { label: "Shell", description: "Exécuter des commandes" },
  git: { label: "Git", description: "Historique, branches, commits" },
  browser: { label: "Navigateur", description: "Piloter un navigateur" },
  web: { label: "Web", description: "Recherche et lecture de pages web" },
};

export function AgentsScreen() {
  const [items, setItems] = useState<Agent[]>(agentFixtures);
  const [selectedId, setSelectedId] = useState<string>(agentFixtures[0].id);
  const selected = items.find((a) => a.id === selectedId);

  const update = (id: string, patch: Partial<Agent>) =>
    setItems((list) => list.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  const create = () => {
    const id = `agent-${Date.now().toString(36)}`;
    const agent: Agent = {
      id,
      name: "Nouvel agent",
      objective: "",
      instructions: "",
      preferredHarnessIds: [],
      skillIds: [],
      toolIds: ["read", "grep"],
      permissions: {
        read: "allow",
        write: "ask",
        shell: "ask",
        network: "ask",
        git: "ask",
        external: "deny",
        dangerous: "deny",
      },
      /* Until the translation is tested, compatibility follows each harness's "Agents Warden" capability. */
      compat: Object.fromEntries(
        harnesses.map((h) => [
          h.id,
          {
            support: h.capabilities.customAgents.support,
            note: `Déduit de la capacité Agents de ${h.name}${
              h.capabilities.customAgents.note ? ` : ${h.capabilities.customAgents.note}` : ""
            }`,
          },
        ]),
      ) as Record<HarnessId, CapabilitySupport>,
    };
    setItems((list) => [...list, agent]);
    setSelectedId(id);
  };

  return (
    <Page
      title="Agents"
      subtitle="Agents spécialisés : objectif, instructions, modèle, skills, outils et permissions (CDC §14, §30)."
      bodyClassName="p-0 overflow-hidden"
      actions={
        <Button size="sm" onClick={create}>
          <Plus />
          Nouvel agent
        </Button>
      }
    >
      <div className="flex h-full min-h-0">
        <div className="w-80 shrink-0 space-y-2 overflow-auto border-r border-border p-3">
          {items.map((a) => (
            <ListItem key={a.id} selected={a.id === selectedId} onSelect={() => setSelectedId(a.id)}>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 font-medium">
                  <Bot className="size-4 text-muted-foreground" />
                  {a.name}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{a.objective || "Objectif à définir"}</p>
                <HarnessCompatStrip compat={a.compat} />
              </div>
            </ListItem>
          ))}
        </div>

        <div className="min-w-0 flex-1 overflow-auto bg-sculk p-6">
          {selected ? (
            <AgentDetail key={selected.id} agent={selected} onChange={(patch) => update(selected.id, patch)} />
          ) : (
            <EmptyState icon={<Bot />} title="Sélectionnez un agent" />
          )}
        </div>
      </div>
    </Page>
  );
}

function AgentDetail({ agent: a, onChange }: { agent: Agent; onChange: (patch: Partial<Agent>) => void }) {
  const preferredModel = a.preferredModelId ? getModel(a.preferredModelId) : undefined;
  const toggleSkill = (id: string, checked: boolean) =>
    onChange({ skillIds: checked ? [...a.skillIds, id] : a.skillIds.filter((s) => s !== id) });

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-3">
        <Input
          value={a.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="h-9 max-w-xs text-base font-medium"
          aria-label="Nom de l'agent"
        />
        <LocalStateNote />
      </div>

      <Section title="Rôle">
        <div className="space-y-4">
          <Field label="Objectif">
            <Input
              value={a.objective}
              onChange={(e) => onChange({ objective: e.target.value })}
              placeholder="Ce que l'agent doit accomplir"
            />
          </Field>
          <Field label="Instructions" hint="Traduites vers le format de chaque harness (agent, sous-agent ou prompt).">
            <Textarea
              value={a.instructions}
              onChange={(e) => onChange({ instructions: e.target.value })}
              className="min-h-24"
            />
          </Field>
        </div>
      </Section>

      <Section title="Exécution">
        <div className="grid gap-6 lg:grid-cols-2">
          <Field label="Modèle préféré">
            <Select
              value={a.preferredModelId ?? NO_MODEL}
              onValueChange={(id) => onChange({ preferredModelId: id === NO_MODEL ? undefined : id })}
            >
              <SelectTrigger size="sm" className="min-w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MODEL}>Celui du profil ou de la session</SelectItem>
                {providers.map((p) => (
                  <SelectGroup key={p.id}>
                    <SelectLabel>{p.name}</SelectLabel>
                    {modelsForProvider(p.id).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {preferredModel && a.preferredHarnessIds.length > 0 && (
              <div className="space-y-1 pt-1">
                {a.preferredHarnessIds.map((hid) => (
                  <div key={hid} className="flex items-center gap-2 text-xs">
                    <span className="w-24 text-muted-foreground">{getHarness(hid).name}</span>
                    <CompatBadge
                      verdict={checkCombination({
                        harnessId: hid,
                        providerId: preferredModel.providerId,
                        modelId: preferredModel.id,
                      })}
                    />
                  </div>
                ))}
              </div>
            )}
          </Field>

          <Field label="Harnesses préférés" hint="Ordre de préférence lorsque le profil ne fixe pas de harness.">
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              spacing={0}
              value={a.preferredHarnessIds}
              onValueChange={(ids) => onChange({ preferredHarnessIds: ids as HarnessId[] })}
              className="flex-wrap"
            >
              {harnesses.map((h) => (
                <ToggleGroupItem key={h.id} value={h.id} className="data-[state=on]:text-primary">
                  {h.name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {a.preferredHarnessIds
              .filter((hid) => a.compat[hid].support !== "supported")
              .map((hid) => (
                <p key={hid} className="flex items-start gap-1.5 text-[11px] text-warning">
                  <SupportBadge support={a.compat[hid].support} compact note={a.compat[hid].note} />
                  {getHarness(hid).name} : {a.compat[hid].note ?? SUPPORT_LABELS[a.compat[hid].support]}
                </p>
              ))}
          </Field>
        </div>
      </Section>

      <Section title="Skills et outils">
        <div className="grid gap-6 lg:grid-cols-2">
          <Field label="Skills">
            <div className="space-y-2">
              {skills.map((s) => (
                <Label key={s.id} className="font-normal">
                  <Checkbox
                    checked={a.skillIds.includes(s.id)}
                    onCheckedChange={(checked) => toggleSkill(s.id, checked === true)}
                  />
                  <span className="font-mono text-xs">{s.name}</span>
                  {!s.enabled && <span className="text-[10px] text-warning">désactivé</span>}
                </Label>
              ))}
            </div>
          </Field>
          <Field
            label="Outils"
            hint="Ce que l'agent peut appeler ; les permissions ci-dessous décident s'il doit demander."
          >
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              spacing={1}
              value={a.toolIds}
              onValueChange={(toolIds) => onChange({ toolIds })}
              className="flex-wrap"
            >
              {Object.entries(TOOLS).map(([id, t]) => (
                <ToggleGroupItem key={id} value={id} title={t.description} className="data-[state=on]:text-primary">
                  {t.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </div>
      </Section>

      <Section title="Permissions">
        <PermissionPolicyEditor value={a.permissions} onChange={(permissions) => onChange({ permissions })} />
      </Section>

      <Section title="Compatibilité par harness">
        <HarnessCompatTable
          compat={a.compat}
          footnote={(hid) => {
            const cap = getHarness(hid).capabilities.customAgents;
            return `Agents Warden : ${SUPPORT_LABELS[cap.support].toLowerCase()}${cap.note ? ` — ${cap.note}` : ""}`;
          }}
        />
        <p className="text-xs text-muted-foreground">
          La traduction exacte d'un agent vers chaque harness reste à définir (CDC §14) ; ces verdicts décrivent
          l'approche envisagée.
        </p>
      </Section>
    </div>
  );
}
