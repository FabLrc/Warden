import { FlaskConical, Info, OctagonX, Play, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useCurrentProject } from "@/app/project-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Page, Section } from "@/components/warden/page";
import { formatDuration } from "@/lib/format";
import { VARIABLE_LABELS, WORKLOAD_LABELS } from "@/lib/labels";
import { links } from "@/lib/links";
import { experiments, featuresOff } from "@/mock/fixtures/lab";
import { projects } from "@/mock/fixtures/workspace";
import { getProfile, getProject } from "@/mock/queries";
import type { Experiment, ExperimentVariable, LabConfiguration, Workload } from "@/mock/types";
import { CheckersEditor } from "@/screens/lab/CheckersEditor";
import { ConfigurationEditor } from "@/screens/lab/ConfigurationEditor";
import { ISOLATION_HELP, ISOLATION_LABELS, TOGGLE_ON } from "@/screens/lab/lab-meta";
import { ReproducibilityPanel } from "@/screens/lab/ReproducibilityPanel";
import {
  analyzeExperiment,
  differingDimensions,
  type ExperimentDefinition,
  VARIABLE_DIMENSION,
} from "@/screens/lab/reproducibility";

/** The example opened from the "launch" dialog: a completed run of the P8 comparison. */
const EXAMPLE_EXPERIMENT_ID = "exp-refresh-token";

const VARIABLE_HELP: Record<ExperimentVariable, string> = {
  harness: "Même modèle, même agent et mêmes skills ; seul le moteur change.",
  model: "Même harness ; seul le modèle (et son provider) change.",
  skill: "Configurations identiques, avec et sans un skill.",
  agent: "Configurations identiques, avec des agents différents.",
  feature: "Baseline vs la même configuration avec une fonctionnalité Warden activée.",
};

interface FormState extends ExperimentDefinition {
  name: string;
  workload: Workload;
  projectId: string;
}

let idCounter = 0;
const nextId = (prefix: string) => `${prefix}-new-${++idCounter}`;

function blankForm(projectId: string): FormState {
  const project = getProject(projectId);
  const daily = getProfile("daily");
  const base: LabConfiguration = {
    id: nextId("cfg"),
    label: "Configuration A",
    harnessId: daily?.harnessId ?? "opencode",
    providerId: daily?.providerId ?? "anthropic",
    modelId: daily?.modelId ?? "claude-sonnet",
    agentId: daily?.agentId,
    skillIds: daily?.skillIds ?? [],
    features: featuresOff(),
  };
  return {
    name: "",
    task: "",
    workload: "debugging",
    projectId,
    initialState: { kind: "git-ref", ref: project?.branch ?? "main", description: "" },
    isolation: "git-worktree",
    variable: "harness",
    configurations: [base, { ...base, id: nextId("cfg"), label: "Configuration B" }],
    runsPerConfiguration: 3,
    timeLimitMinutes: 30,
    checkers: [{ id: nextId("chk"), kind: "tests", label: "Tests", command: "npm test" }],
  };
}

function formFromExperiment(e: Experiment): FormState {
  return {
    name: `${e.name} (copie)`,
    task: e.task,
    workload: e.workload,
    projectId: e.projectId,
    initialState: { ...e.initialState },
    isolation: e.isolation,
    variable: e.variable,
    configurations: e.configurations.map((c) => ({ ...c, skillIds: [...c.skillIds], features: { ...c.features } })),
    runsPerConfiguration: e.runsPerConfiguration,
    timeLimitMinutes: e.timeLimitMinutes,
    checkers: e.checkers.map((k) => ({ ...k })),
  };
}

export function NewExperimentScreen() {
  const [params] = useSearchParams();
  const fromId = params.get("from");
  // Remount on source change so the form restarts from the selected experiment.
  return <NewExperimentForm key={fromId ?? "blank"} source={experiments.find((e) => e.id === fromId)} />;
}

function NewExperimentForm({ source }: { source?: Experiment }) {
  const navigate = useNavigate();
  const { projectId: currentProjectId } = useCurrentProject();
  const [form, setForm] = useState<FormState>(() =>
    source ? formFromExperiment(source) : blankForm(currentProjectId),
  );
  const [launchOpen, setLaunchOpen] = useState(false);

  const issues = analyzeExperiment(form);
  const studied = VARIABLE_DIMENSION[form.variable];
  const confounders = differingDimensions(form.configurations).filter((d) => d !== studied);
  const totalRuns = form.configurations.length * form.runsPerConfiguration;

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));
  const setConfigurations = (update: (configs: LabConfiguration[]) => LabConfiguration[]) =>
    setForm((f) => ({ ...f, configurations: update(f.configurations) }));
  const duplicate = (c: LabConfiguration) =>
    setConfigurations((cs) => [
      ...cs,
      {
        ...c,
        id: nextId("cfg"),
        label: `Configuration ${String.fromCharCode(65 + cs.length)}`,
        skillIds: [...c.skillIds],
        features: { ...c.features },
      },
    ]);

  return (
    <Page
      title={source ? `Nouvelle expérience · depuis « ${source.name} »` : "Nouvelle expérience"}
      subtitle="Une tâche, plusieurs configurations, une seule variable, une validation externe"
      actions={
        <>
          <Select value={source?.id ?? ""} onValueChange={(id) => navigate(`${links.newExperiment()}?from=${id}`)}>
            <SelectTrigger size="sm" className="min-w-52" aria-label="Partir d'une expérience existante">
              <SelectValue placeholder="Partir d'une expérience…" />
            </SelectTrigger>
            <SelectContent>
              {experiments.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setLaunchOpen(true)}>
            <Play />
            Lancer
          </Button>
        </>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-8">
          <Section title="1 · Tâche">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
              <FormField label="Nom" htmlFor="exp-name">
                <Input
                  id="exp-name"
                  value={form.name}
                  onChange={(ev) => patch({ name: ev.target.value })}
                  placeholder="ex. Bug refresh token — OpenCode vs Claude Code"
                />
              </FormField>
              <FormField label="Workload">
                <Select value={form.workload} onValueChange={(w) => patch({ workload: w as Workload })}>
                  <SelectTrigger className="w-full" aria-label="Workload">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(WORKLOAD_LABELS) as Workload[]).map((w) => (
                      <SelectItem key={w} value={w}>
                        {WORKLOAD_LABELS[w]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Projet">
                <Select
                  value={form.projectId}
                  onValueChange={(projectId) =>
                    patch({
                      projectId,
                      initialState: { ...form.initialState, ref: getProject(projectId)?.branch ?? "main" },
                    })
                  }
                >
                  <SelectTrigger className="w-full" aria-label="Projet">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Prompt envoyé à chaque run" htmlFor="exp-task">
              <Textarea
                id="exp-task"
                value={form.task}
                onChange={(ev) => patch({ task: ev.target.value })}
                rows={4}
                placeholder="Décrire la tâche exactement comme elle sera envoyée à l'agent, critères de réussite compris."
              />
            </FormField>
          </Section>

          <Section title="2 · État initial et isolation">
            <div className="grid gap-3 md:grid-cols-[16rem_minmax(0,1fr)]">
              <FormField label="Ref git de départ" htmlFor="exp-ref">
                <Input
                  id="exp-ref"
                  value={form.initialState.ref}
                  onChange={(ev) => patch({ initialState: { ...form.initialState, ref: ev.target.value } })}
                  className="font-mono text-xs"
                  placeholder="branche@commit"
                />
              </FormField>
              <FormField label="Description de l'état" htmlFor="exp-ref-desc">
                <Input
                  id="exp-ref-desc"
                  value={form.initialState.description}
                  onChange={(ev) => patch({ initialState: { ...form.initialState, description: ev.target.value } })}
                  placeholder="ex. bug reproduit, aucun correctif"
                />
              </FormField>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={form.isolation}
                onValueChange={(v) => v && patch({ isolation: v as Experiment["isolation"] })}
              >
                {(Object.keys(ISOLATION_LABELS) as Experiment["isolation"][]).map((i) => (
                  <ToggleGroupItem key={i} value={i} className={TOGGLE_ON}>
                    {ISOLATION_LABELS[i]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <span className="text-xs text-muted-foreground">{ISOLATION_HELP[form.isolation]}</span>
            </div>
          </Section>

          <Section title="3 · Variable étudiée">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={form.variable}
              onValueChange={(v) => v && patch({ variable: v as ExperimentVariable })}
            >
              {(Object.keys(VARIABLE_LABELS) as ExperimentVariable[]).map((v) => (
                <ToggleGroupItem key={v} value={v} className={TOGGLE_ON}>
                  {VARIABLE_LABELS[v]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {VARIABLE_HELP[form.variable]} Dupliquez une configuration puis ne modifiez que le champ surligné.
            </p>
          </Section>

          <Section
            title={`4 · Configurations (${form.configurations.length})`}
            actions={
              <Button
                variant="outline"
                size="xs"
                onClick={() => duplicate(form.configurations[form.configurations.length - 1])}
              >
                <Plus />
                Ajouter une configuration
              </Button>
            }
          >
            <div className="space-y-3">
              {form.configurations.map((c) => (
                <ConfigurationEditor
                  key={c.id}
                  config={c}
                  projectId={form.projectId}
                  studied={studied}
                  confounders={confounders}
                  canRemove={form.configurations.length > 1}
                  onChange={(next) => setConfigurations((cs) => cs.map((x) => (x.id === c.id ? next : x)))}
                  onDuplicate={() => duplicate(c)}
                  onRemove={() => setConfigurations((cs) => cs.filter((x) => x.id !== c.id))}
                />
              ))}
            </div>
          </Section>

          <Section title="5 · Exécution">
            <div className="flex flex-wrap items-end gap-4">
              <FormField label="Runs par configuration" htmlFor="exp-runs">
                <Input
                  id="exp-runs"
                  type="number"
                  min={1}
                  max={20}
                  value={form.runsPerConfiguration}
                  onChange={(ev) => patch({ runsPerConfiguration: clampInt(ev.target.value, 1, 20) })}
                  className="w-28 tabular-nums"
                />
              </FormField>
              <FormField label="Limite de temps par run (min)" htmlFor="exp-time">
                <Input
                  id="exp-time"
                  type="number"
                  min={1}
                  max={240}
                  value={form.timeLimitMinutes}
                  onChange={(ev) => patch({ timeLimitMinutes: clampInt(ev.target.value, 1, 240) })}
                  className="w-28 tabular-nums"
                />
              </FormField>
              <p className="pb-2 text-xs text-muted-foreground">
                <span className="text-foreground tabular-nums">{totalRuns} runs</span> au total · au plus{" "}
                {formatDuration(totalRuns * form.timeLimitMinutes * 60_000)} si exécutés l'un après l'autre
              </p>
            </div>
          </Section>

          <Section title="6 · Validation externe">
            <CheckersEditor
              checkers={form.checkers}
              onChange={(checkers) => patch({ checkers })}
              newId={() => nextId("chk")}
            />
          </Section>
        </div>

        <aside className="xl:sticky xl:top-0 xl:self-start">
          <ReproducibilityPanel definition={form} issues={issues} />
        </aside>
      </div>

      <LaunchDialog
        open={launchOpen}
        onOpenChange={setLaunchOpen}
        totalRuns={totalRuns}
        form={form}
        blocking={issues.filter((i) => i.severity === "blocking").map((i) => i.title)}
        onOpenExample={() => navigate(links.experiment(EXAMPLE_EXPERIMENT_ID))}
      />
    </Page>
  );
}

function clampInt(raw: string, min: number, max: number): number {
  const n = Number.parseInt(raw, 10);
  return Number.isNaN(n) ? min : Math.min(max, Math.max(min, n));
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function LaunchDialog({
  open,
  onOpenChange,
  totalRuns,
  form,
  blocking,
  onOpenExample,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalRuns: number;
  form: FormState;
  blocking: string[];
  onOpenExample: () => void;
}) {
  const example = experiments.find((e) => e.id === EXAMPLE_EXPERIMENT_ID);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="size-4 text-primary" />
            Lancement non exécuté (Étape 0)
          </DialogTitle>
          <DialogDescription>
            Cette maquette ne lance aucun harness. Dans le produit, Warden créerait ici {totalRuns} runs (
            {form.configurations.length} configurations × {form.runsPerConfiguration}), chacun dans un{" "}
            {ISOLATION_LABELS[form.isolation].toLowerCase()} neuf depuis{" "}
            <code className="font-mono text-soul">{form.initialState.ref || "?"}</code>, limité à{" "}
            {form.timeLimitMinutes} min, puis exécuterait les checkers.
          </DialogDescription>
        </DialogHeader>
        {blocking.length > 0 && (
          <div className="space-y-1 rounded-md border border-destructive/35 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <div className="flex items-center gap-1.5 font-medium">
              <OctagonX className="size-3.5" />
              Le lancement serait refusé :
            </div>
            <ul className="list-disc space-y-0.5 pl-5">
              {blocking.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        )}
        {example && (
          <p className="text-xs text-muted-foreground">
            Pour voir à quoi ressemblent les résultats, ouvrez l'exemple terminé « {example.name} ».
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Continuer l'édition</Button>
          </DialogClose>
          {example && (
            <Button onClick={onOpenExample}>
              <FlaskConical />
              Ouvrir l'exemple
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
