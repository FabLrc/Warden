import { Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Checker } from "@/mock/types";
import { CHECKER_KIND_LABELS } from "@/screens/lab/lab-meta";

const KINDS = Object.keys(CHECKER_KIND_LABELS) as Checker["kind"][];

const DEFAULT_COMMANDS: Record<Checker["kind"], string> = {
  tests: "npm test",
  lint: "npm run lint",
  build: "npm run build",
  custom: "",
};

/** CDC §23 — success is decided by external checks, never by the agent itself. */
export function CheckersEditor({
  checkers,
  onChange,
  newId,
}: {
  checkers: Checker[];
  onChange: (checkers: Checker[]) => void;
  newId: () => string;
}) {
  const update = (id: string, patch: Partial<Checker>) =>
    onChange(checkers.map((k) => (k.id === id ? { ...k, ...patch } : k)));

  return (
    <div className="space-y-2">
      {checkers.length === 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-dashed border-warning/40 px-3 py-2.5 text-xs text-warning">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          Aucun checker : la réussite reposerait sur la déclaration de l'agent. Ajoutez au moins des tests ou un check
          personnalisé.
        </div>
      ) : (
        <div className="space-y-1.5">
          {checkers.map((k) => (
            <div key={k.id} className="flex items-center gap-2">
              <Select value={k.kind} onValueChange={(kind) => update(k.id, { kind: kind as Checker["kind"] })}>
                <SelectTrigger size="sm" className="w-36 shrink-0" aria-label="Type de checker">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {CHECKER_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={k.label}
                onChange={(ev) => update(k.id, { label: ev.target.value })}
                placeholder="Nom"
                className="h-7 w-40 shrink-0"
                aria-label="Nom du checker"
              />
              <Input
                value={k.command}
                onChange={(ev) => update(k.id, { command: ev.target.value })}
                placeholder="Commande, ex. npm test -- auth"
                className="h-7 font-mono text-xs"
                aria-label="Commande du checker"
                aria-invalid={k.command.trim() === ""}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onChange(checkers.filter((c) => c.id !== k.id))}
                aria-label="Supprimer le checker"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {KINDS.map((kind) => (
          <Button
            key={kind}
            variant="outline"
            size="xs"
            onClick={() =>
              onChange([
                ...checkers,
                { id: newId(), kind, label: CHECKER_KIND_LABELS[kind], command: DEFAULT_COMMANDS[kind] },
              ])
            }
          >
            <Plus />
            {CHECKER_KIND_LABELS[kind]}
          </Button>
        ))}
      </div>
    </div>
  );
}
