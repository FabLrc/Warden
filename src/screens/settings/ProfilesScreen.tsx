import { AlertTriangle, Bot, Pencil, Play, Plus, Star } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useCurrentProject } from "@/app/project-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CompatBadge, HarnessBadge, ModelLabel } from "@/components/warden/badges";
import { ConfigPicker, type PickerValue } from "@/components/warden/config-picker";
import { Page } from "@/components/warden/page";
import { links } from "@/lib/links";
import { agents, profiles as profileFixtures, projects, skills } from "@/mock/fixtures/workspace";
import { checkCombination, getAgent, getProject, getSkill } from "@/mock/queries";
import type { Profile } from "@/mock/types";
import { Field, LocalStateNote, ScopeChip, ScopeEditor, scopeLabel } from "./shared";

const NO_AGENT = "__none__";

type DialogState = { mode: "create" } | { mode: "edit"; profile: Profile } | null;

const EMPTY_PROFILE: Profile = {
  id: "",
  name: "",
  description: "",
  scope: { kind: "global" },
  harnessId: "opencode",
  providerId: "anthropic",
  modelId: "claude-sonnet",
  skillIds: [],
};

export function ProfilesScreen() {
  const [items, setItems] = useState<Profile[]>(profileFixtures);
  const [dialog, setDialog] = useState<DialogState>(null);
  const { projectId: currentProjectId } = useCurrentProject();

  const save = (profile: Profile) => {
    setItems((list) =>
      list.some((p) => p.id === profile.id) ? list.map((p) => (p.id === profile.id ? profile : p)) : [...list, profile],
    );
    setDialog(null);
  };

  return (
    <Page
      title="Profils"
      subtitle="Configurations réutilisables harness + modèle + agent + skills, globales ou propres à un projet (CDC §12)."
      actions={
        <Button size="sm" onClick={() => setDialog({ mode: "create" })}>
          <Plus />
          Nouveau profil
        </Button>
      }
    >
      <div className="space-y-4">
        <LocalStateNote />
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              launchProjectId={p.scope.kind === "project" ? (p.scope.projectIds[0] ?? null) : currentProjectId}
              launchable={profileFixtures.some((f) => f.id === p.id)}
              onEdit={() => setDialog({ mode: "edit", profile: p })}
            />
          ))}
        </div>
      </div>

      {dialog && (
        <ProfileDialog
          key={dialog.mode === "edit" ? dialog.profile.id : "new"}
          initial={dialog.mode === "edit" ? dialog.profile : EMPTY_PROFILE}
          creating={dialog.mode === "create"}
          onCancel={() => setDialog(null)}
          onSave={save}
        />
      )}
    </Page>
  );
}

function ProfileCard({
  profile: p,
  launchProjectId,
  launchable,
  onEdit,
}: {
  profile: Profile;
  launchProjectId: string | null;
  launchable: boolean;
  onEdit: () => void;
}) {
  const verdict = checkCombination(p);
  const agent = p.agentId ? getAgent(p.agentId) : undefined;
  const defaultFor = projects.filter((proj) => proj.defaultProfileId === p.id);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{p.name}</span>
            <ScopeChip scope={p.scope} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{p.description || "Sans description"}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Modifier ${p.name}`}>
          <Pencil />
        </Button>
      </div>

      <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-2 text-xs">
        <span className="text-muted-foreground">Harness</span>
        <span>
          <HarnessBadge harnessId={p.harnessId} />
        </span>
        <span className="text-muted-foreground">Modèle</span>
        <ModelLabel providerId={p.providerId} modelId={p.modelId} />
        <span className="text-muted-foreground">Agent</span>
        <span className="inline-flex items-center gap-1.5">
          {agent ? (
            <>
              <Bot className="size-3.5 text-muted-foreground" />
              <Link to={links.agents()} className="hover:text-primary">
                {agent.name}
              </Link>
            </>
          ) : (
            <span className="text-muted-foreground">Aucun</span>
          )}
        </span>
        <span className="text-muted-foreground">Skills</span>
        <span className="flex flex-wrap gap-1">
          {p.skillIds.length === 0 ? (
            <span className="text-muted-foreground">Aucun</span>
          ) : (
            p.skillIds.map((id) => (
              <Link
                key={id}
                to={links.skills()}
                className="rounded border border-border bg-secondary/60 px-1.5 font-mono text-[11px] hover:text-primary"
              >
                {getSkill(id)?.name ?? id}
              </Link>
            ))
          )}
        </span>
      </div>

      {verdict.status !== "supported" && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <div className="space-y-1">
            <CompatBadge verdict={verdict} />
            <p>{verdict.reason ?? "Combinaison non vérifiée."}</p>
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {defaultFor.length > 0 && (
            <>
              <Star className="size-3 text-bone" />
              Profil par défaut de {defaultFor.map((proj) => proj.name).join(", ")}
            </>
          )}
        </span>
        <LaunchButton profile={p} project={launchProjectId} launchable={launchable} />
      </div>
    </div>
  );
}

function LaunchButton({
  profile,
  project,
  launchable,
}: {
  profile: Profile;
  project: string | null;
  launchable: boolean;
}) {
  const disabledReason = !launchable
    ? "Profil créé dans la maquette : il n'existe pas encore pour l'écran de session."
    : project === null
      ? "Ce profil n'est associé à aucun projet."
      : null;

  if (disabledReason || project === null) {
    return (
      <span className="flex items-center gap-2">
        <span className="max-w-56 text-right text-[11px] text-muted-foreground">{disabledReason}</span>
        <Button size="sm" variant="outline" disabled>
          <Play />
          Démarrer une session
        </Button>
      </span>
    );
  }

  return (
    <Button size="sm" variant="outline" asChild>
      <Link to={links.newSession(project, profile.id)}>
        <Play />
        Démarrer dans {getProject(project)?.name ?? project}
      </Link>
    </Button>
  );
}

function ProfileDialog({
  initial,
  creating,
  onCancel,
  onSave,
}: {
  initial: Profile;
  creating: boolean;
  onCancel: () => void;
  onSave: (profile: Profile) => void;
}) {
  const [draft, setDraft] = useState<Profile>(initial);
  const picker: PickerValue = { harnessId: draft.harnessId, providerId: draft.providerId, modelId: draft.modelId };
  const verdict = checkCombination(picker);
  const nameMissing = draft.name.trim() === "";
  const scopeEmpty = draft.scope.kind === "project" && draft.scope.projectIds.length === 0;

  const toggleSkill = (id: string, checked: boolean) =>
    setDraft((d) => ({ ...d, skillIds: checked ? [...d.skillIds, id] : d.skillIds.filter((s) => s !== id) }));

  const submit = () => {
    const name = draft.name.trim();
    onSave({
      ...draft,
      name,
      id: draft.id || `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{creating ? "Nouveau profil" : `Modifier « ${initial.name} »`}</DialogTitle>
          <DialogDescription>
            Un profil se choisit au lancement d'une session ; il reste modifiable session par session.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="ex. Review rapide"
                aria-invalid={nameMissing}
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className="min-h-9"
                rows={1}
              />
            </Field>
          </div>

          <Field label="Portée" hint={scopeLabel(draft.scope)}>
            <ScopeEditor value={draft.scope} onChange={(scope) => setDraft({ ...draft, scope })} />
          </Field>

          <Field label="Harness → Provider → Modèle">
            <ConfigPicker
              value={picker}
              onChange={(v) =>
                setDraft({ ...draft, harnessId: v.harnessId, providerId: v.providerId, modelId: v.modelId })
              }
              showProfile={false}
            />
            {verdict.status === "unsupported" && (
              <p className="text-xs text-destructive">
                Cette combinaison ne pourra pas être lancée. Le profil peut être enregistré, mais il sera signalé.
              </p>
            )}
          </Field>

          <Field label="Agent">
            <Select
              value={draft.agentId ?? NO_AGENT}
              onValueChange={(id) => setDraft({ ...draft, agentId: id === NO_AGENT ? undefined : id })}
            >
              <SelectTrigger size="sm" className="min-w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_AGENT}>Aucun</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    {a.compat[draft.harnessId].support === "unsupported" && (
                      <span className="text-[10px] text-warning">non supporté par ce harness</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {draft.agentId && getAgent(draft.agentId)?.compat[draft.harnessId].note && (
              <p className="text-[11px] text-muted-foreground">
                {getAgent(draft.agentId)?.compat[draft.harnessId].note}
              </p>
            )}
          </Field>

          <Field label="Skills">
            <div className="grid gap-2 sm:grid-cols-2">
              {skills.map((s) => (
                <Label key={s.id} className="items-start font-normal">
                  <Checkbox
                    checked={draft.skillIds.includes(s.id)}
                    onCheckedChange={(checked) => toggleSkill(s.id, checked === true)}
                    className="mt-0.5"
                  />
                  <span className="space-y-0.5">
                    <span className="block font-mono text-xs">
                      {s.name}
                      {!s.enabled && <span className="ml-1.5 font-sans text-[10px] text-warning">désactivé</span>}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {s.compat[draft.harnessId].support === "supported"
                        ? scopeLabel(s.scope)
                        : `${scopeLabel(s.scope)} · ${s.compat[draft.harnessId].note ?? "support limité avec ce harness"}`}
                    </span>
                  </span>
                </Label>
              ))}
            </div>
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={nameMissing || scopeEmpty}>
            {creating ? "Créer le profil" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
