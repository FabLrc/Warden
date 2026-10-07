import { ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SupportBadge } from "@/components/warden/badges";
import { PERMISSION_KIND_LABELS, PERMISSION_POLICY_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { harnesses } from "@/mock/fixtures/catalog";
import type { PermissionKind, PermissionPolicy, PermissionPolicyValue } from "@/mock/types";

const PERMISSION_KIND_HELP: Record<PermissionKind, string> = {
  read: "Lire les fichiers du projet",
  write: "Créer, modifier ou supprimer des fichiers",
  shell: "Exécuter des commandes",
  network: "Accès réseau : requêtes, installation de paquets",
  git: "Commit, changement de branche, push",
  external: "Effets hors de la machine : issues, déploiements, messages",
  dangerous: "Suppressions massives, force push, commandes destructrices",
};

const PERMISSION_KINDS = Object.keys(PERMISSION_KIND_LABELS) as PermissionKind[];

const POLICY_VALUES: PermissionPolicyValue[] = ["allow", "ask", "deny"];

const POLICY_ON_CLASSES: Record<PermissionPolicyValue, string> = {
  allow: "data-[state=on]:bg-success/15 data-[state=on]:text-success",
  ask: "data-[state=on]:bg-warning/15 data-[state=on]:text-warning",
  deny: "data-[state=on]:bg-destructive/15 data-[state=on]:text-destructive",
};

/** CDC §30 policy matrix + CDC §31 honesty about what it does (and does not) enforce. */
export function PermissionPolicyEditor({
  value,
  onChange,
}: {
  value: PermissionPolicy;
  onChange: (policy: PermissionPolicy) => void;
}) {
  return (
    <div className="space-y-4">
      <Alert className="border-warning/40">
        <ShieldAlert className="text-warning" />
        <AlertTitle>Politique applicative, pas une sandbox système</AlertTitle>
        <AlertDescription>
          Ces règles sont appliquées par Warden et par le harness aux demandes qu'ils voient passer. Elles n'isolent pas
          le processus : une commande autorisée peut, par exemple, accéder au réseau ou au disque hors du projet. Une
          vraie isolation (conteneur, VM) est un autre mécanisme.
        </AlertDescription>
      </Alert>

      <div className="divide-y divide-border rounded-lg border border-border bg-card">
        {PERMISSION_KINDS.map((kind) => (
          <div key={kind} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <div className="text-sm font-medium">{PERMISSION_KIND_LABELS[kind]}</div>
              <div className="text-xs text-muted-foreground">{PERMISSION_KIND_HELP[kind]}</div>
            </div>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={value[kind]}
              onValueChange={(v) => v && onChange({ ...value, [kind]: v as PermissionPolicyValue })}
              aria-label={`Politique ${PERMISSION_KIND_LABELS[kind]}`}
            >
              {POLICY_VALUES.map((p) => (
                <ToggleGroupItem key={p} value={p} className={cn("px-3", POLICY_ON_CLASSES[p])}>
                  {PERMISSION_POLICY_LABELS[p]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">
          Ce que chaque harness permet réellement d'appliquer
        </div>
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {harnesses.map((h) => {
            const cap = h.capabilities.permissions;
            return (
              <div key={h.id} className="grid grid-cols-[7rem_auto_1fr] items-center gap-3 px-3 py-1.5 text-xs">
                <span className="font-medium">{h.name}</span>
                <SupportBadge support={cap.support} />
                <span className="text-muted-foreground">
                  {cap.note ??
                    (cap.support === "supported" ? "Chaque demande de permission est relayée à Warden." : "")}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
