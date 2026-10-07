import { AlertTriangle, Ban, Bot, Settings2, Sparkles, Square } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CompatBadge, HarnessBadge, ModelLabel, SessionStatusBadge, SupportBadge } from "@/components/warden/badges";
import { ConfigPicker, type PickerValue, valueFromProfile } from "@/components/warden/config-picker";
import { Page } from "@/components/warden/page";
import { PERMISSION_KIND_LABELS, PERMISSION_POLICY_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { cn } from "@/lib/utils";
import { harnesses } from "@/mock/fixtures/catalog";
import { checkCombination, getAgent, getHarness, getProfile, getSkill, profilesForProject } from "@/mock/queries";
import { useReplay } from "@/mock/replay";
import type { PermissionKind, PermissionPolicyValue, Project } from "@/mock/types";
import { Composer } from "@/screens/work/composer";
import { Conversation, type ConversationLinks } from "@/screens/work/conversation";
import { HarnessFeatureGrid, HarnessFeatureSummary } from "@/screens/work/harness-features";
import { liveFiles, useAutoScroll, useEscapeToInterrupt } from "@/screens/work/session-hooks";
import { SessionInspector } from "@/screens/work/session-inspector";

const POLICY_CLASSES: Record<PermissionPolicyValue, string> = {
  allow: "text-success",
  ask: "text-warning",
  deny: "text-destructive",
};

/** Sensitive permission kinds worth showing before starting (CDC §30). */
const SHOWN_PERMISSIONS: PermissionKind[] = ["write", "shell", "network", "git"];

function initialValue(project: Project, profileId: string | undefined): PickerValue {
  const profile =
    (profileId ? getProfile(profileId) : undefined) ??
    (project.defaultProfileId ? getProfile(project.defaultProfileId) : undefined) ??
    profilesForProject(project.id)[0];
  return profile
    ? valueFromProfile(profile)
    : { harnessId: "opencode", providerId: "anthropic", modelId: "claude-sonnet" };
}

/** New session: pick profile / harness / provider / model, see what the harness cannot do, then start. */
export function NewSession({ project, initialProfileId }: { project: Project; initialProfileId?: string }) {
  const [value, setValue] = useState<PickerValue>(() => initialValue(project, initialProfileId));
  const [title, setTitle] = useState<string | null>(null);
  const replay = useReplay(`draft-${project.id}`);
  const { scrollRef, contentRef, onScroll } = useAutoScroll();
  useEscapeToInterrupt(replay.active, replay.interrupt);

  // Once started, the configuration is locked to what the engine runs with.
  const config = replay.config ?? value;
  const profile = value.profileId ? getProfile(value.profileId) : undefined;
  const agentId = profile?.agentId;
  const skillIds = profile?.skillIds ?? [];
  const harness = getHarness(config.harnessId);
  const verdict = checkCombination(config);
  const started = replay.status !== "idle";
  const blocked = !started && (!harness.installed || verdict.status === "unsupported");

  const conversationLinks: ConversationLinks = {
    code: (e) => links.code(project.id, { file: e.file?.path, line: e.file?.line, view: "file" }),
    observe: () => undefined,
  };

  return (
    <Page
      title={title ?? "Nouvelle session"}
      subtitle={
        started ? (
          <span className="inline-flex items-center gap-2 py-0.5">
            <HarnessBadge harnessId={config.harnessId} className="h-5" />
            <ModelLabel providerId={config.providerId} modelId={config.modelId} />
            {agentId && <span className="text-xs">· Agent {getAgent(agentId)?.name}</span>}
            {replay.status !== "idle" && <SessionStatusBadge status={replay.status} />}
          </span>
        ) : (
          `${project.name} · ${project.branch}`
        )
      }
      actions={
        replay.active && (
          <Button size="sm" variant="destructive" onClick={replay.interrupt} title="Interrompre (Échap)">
            <Square className="fill-current" /> Interrompre
          </Button>
        )
      }
      inspector={
        <SessionInspector
          config={{ ...config, profileId: value.profileId, agentId, skillIds }}
          metrics={replay.metrics}
          metricsTitle="Métriques (live)"
          files={liveFiles(project.id, replay.events)}
          permissions={replay.events.filter((e) => e.kind === "permission-request")}
        />
      }
      bodyClassName="flex flex-col p-0 overflow-hidden"
    >
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-auto px-6 py-6">
        <div ref={contentRef}>
          {started ? (
            <Conversation
              events={replay.events}
              links={conversationLinks}
              streaming={replay.active}
              onPermission={replay.answer}
            />
          ) : (
            <SessionSetup project={project} value={value} />
          )}
        </div>
      </div>
      <Composer
        active={replay.active}
        disabled={blocked}
        onInterrupt={replay.interrupt}
        onSend={(prompt) => {
          if (!started) setTitle(prompt.length > 70 ? `${prompt.slice(0, 67)}…` : prompt);
          replay.send(prompt, { projectId: project.id, ...config, agentId });
        }}
        placeholder={
          blocked
            ? "Choisissez une configuration utilisable pour démarrer"
            : "Décrivez la tâche… (Entrée pour démarrer)"
        }
        sendLabel={started ? "Envoyer" : "Démarrer"}
        notice={
          started ? undefined : <StartNotice value={value} onChange={setValue} agentId={agentId} skillIds={skillIds} />
        }
        toolbar={
          started ? (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <HarnessBadge harnessId={config.harnessId} className="h-5" />
              <ModelLabel providerId={config.providerId} modelId={config.modelId} />
            </span>
          ) : (
            <ConfigPicker value={value} onChange={setValue} projectId={project.id} />
          )
        }
      />
    </Page>
  );
}

/** Blocking reasons first; otherwise the features this harness will not provide. */
function StartNotice({
  value,
  onChange,
  agentId,
  skillIds,
}: {
  value: PickerValue;
  onChange: (value: PickerValue) => void;
  agentId?: string;
  skillIds: string[];
}) {
  const harness = getHarness(value.harnessId);
  const verdict = checkCombination(value);
  const profile = value.profileId ? getProfile(value.profileId) : undefined;

  if (!harness.installed) {
    const alternatives = harnesses.filter((h) => h.installed);
    return (
      <Alert variant="destructive">
        <Ban />
        <AlertTitle>{harness.name} n'est pas installé : impossible de démarrer</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            {harness.statusDetail ?? `Le harness ${harness.name} est introuvable.`}
            {profile && profile.harnessId === harness.id && ` Le profil ${profile.name} utilise ${harness.name}.`}{" "}
            Choisissez un autre harness pour cette session (le profil reste inchangé) :
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {alternatives.map((h) => {
              const v = checkCombination({ ...value, harnessId: h.id });
              return (
                <Button
                  key={h.id}
                  size="xs"
                  variant="outline"
                  className="text-foreground"
                  disabled={v.status === "unsupported"}
                  title={v.reason ?? `${h.name} prend en charge cette combinaison`}
                  onClick={() => onChange({ ...value, harnessId: h.id })}
                >
                  Utiliser {h.name}
                  <CompatBadge verdict={v} compact />
                </Button>
              );
            })}
            <Link to={links.harnesses()} className="ml-1 text-xs text-muted-foreground hover:text-primary">
              Gérer les harnesses
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (verdict.status === "unsupported") {
    return (
      <Alert variant="destructive">
        <Ban />
        <AlertTitle>Combinaison non supportée</AlertTitle>
        <AlertDescription>
          {verdict.reason}. Changez de provider ou de modèle ci-dessous, ou choisissez un autre harness.{" "}
          <Link to={links.models()} className="underline-offset-2 hover:underline">
            Voir les compatibilités
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-1.5">
      {harness.status === "outdated" && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="size-3.5" />
          {harness.statusDetail}
        </p>
      )}
      <HarnessFeatureSummary harnessId={value.harnessId} agentId={agentId} skillIds={skillIds} />
    </div>
  );
}

/** Empty state before the first prompt: what this session will run with. */
function SessionSetup({ project, value }: { project: Project; value: PickerValue }) {
  const harness = getHarness(value.harnessId);
  const profile = value.profileId ? getProfile(value.profileId) : undefined;
  const agent = profile?.agentId ? getAgent(profile.agentId) : undefined;
  const skillIds = profile?.skillIds ?? [];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Sparkles className="size-4 text-primary" />
          Nouvelle session dans {project.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez un profil, ou ajustez harness, provider et modèle dans la barre du composer, puis décrivez la
          tâche.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profil et agent</h3>
          <div>
            <div className="text-sm font-medium">{profile ? profile.name : "Sans profil"}</div>
            <p className="text-xs text-muted-foreground">
              {profile ? profile.description : "Configuration choisie à la main pour cette session."}
            </p>
          </div>
          <div className="flex items-start gap-2">
            <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
            {agent ? (
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm">
                  <Link to={links.agents()} className="font-medium hover:text-primary">
                    {agent.name}
                  </Link>
                  <SupportBadge
                    support={agent.compat[harness.id].support}
                    note={agent.compat[harness.id].note}
                    label={`avec ${harness.name}`}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{agent.objective}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun agent : le harness utilise son comportement par défaut.
              </p>
            )}
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">Skills</div>
            {skillIds.length === 0 ? (
              <p className="text-xs text-muted-foreground">Aucun skill chargé.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {skillIds.map((id) => {
                  const skill = getSkill(id);
                  if (!skill) return null;
                  const compat = skill.compat[harness.id];
                  return (
                    <span
                      key={id}
                      className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-secondary/50 pr-1 pl-2 font-mono text-xs"
                    >
                      {skill.name}
                      <SupportBadge support={compat.support} note={compat.note} compact />
                    </span>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">
              Permissions {agent ? `de l'agent ${agent.name}` : "par défaut"}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {SHOWN_PERMISSIONS.map((kind) => {
                const policy = agent?.permissions[kind] ?? "ask";
                return (
                  <span key={kind}>
                    <span className="text-muted-foreground">{PERMISSION_KIND_LABELS[kind]} :</span>{" "}
                    <span className={cn("font-medium", POLICY_CLASSES[policy])}>
                      {PERMISSION_POLICY_LABELS[policy]}
                    </span>
                  </span>
                );
              })}
            </div>
            {harness.capabilities.permissions.support !== "supported" && (
              <p className="mt-1 text-[11px] text-warning">{harness.capabilities.permissions.note}</p>
            )}
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fonctionnalités avec {harness.name}
            </h3>
            <Button variant="ghost" size="icon-xs" asChild>
              <Link to={links.harnesses()} title="Détail des harnesses" aria-label="Détail des harnesses">
                <Settings2 />
              </Link>
            </Button>
          </div>
          <HarnessFeatureGrid harnessId={harness.id} />
          {harness.limitations.length > 0 && (
            <ul className="space-y-0.5 border-t border-border pt-2 text-[11px] text-muted-foreground">
              {harness.limitations.map((l) => (
                <li key={l}>· {l}</li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Maquette : le prompt déclenche une session rejouée (aucun harness réel n'est lancé).
      </p>
    </div>
  );
}
