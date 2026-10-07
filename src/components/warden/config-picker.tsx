import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompatBadge } from "@/components/warden/badges";
import { harnesses, providers } from "@/mock/fixtures/catalog";
import { profiles } from "@/mock/fixtures/workspace";
import { checkCombination, checkProvider, getProfile, modelsForProvider } from "@/mock/queries";
import type { HarnessId, Profile } from "@/mock/types";

export interface PickerValue {
  profileId?: string;
  harnessId: HarnessId;
  providerId: string;
  modelId: string;
}

export function valueFromProfile(profile: Profile): PickerValue {
  return {
    profileId: profile.id,
    harnessId: profile.harnessId,
    providerId: profile.providerId,
    modelId: profile.modelId,
  };
}

const NO_PROFILE = "__none__";

/**
 * Profile → Harness → Provider → Model cascade (CDC §11, §12).
 * Incompatible options stay visible with their reason instead of being hidden.
 */
export function ConfigPicker({
  value,
  onChange,
  projectId,
  showProfile = true,
}: {
  value: PickerValue;
  onChange: (value: PickerValue) => void;
  /** Restricts the profile list to global + this project's profiles. */
  projectId?: string;
  showProfile?: boolean;
}) {
  const availableProfiles = profiles.filter(
    (p) => p.scope.kind === "global" || (projectId !== undefined && p.scope.projectIds.includes(projectId)),
  );
  const profile = value.profileId ? getProfile(value.profileId) : undefined;
  const modified =
    profile !== undefined &&
    (profile.harnessId !== value.harnessId ||
      profile.providerId !== value.providerId ||
      profile.modelId !== value.modelId);
  const verdict = checkCombination(value);

  const setHarness = (harnessId: HarnessId) => onChange({ ...value, harnessId });
  const setProvider = (providerId: string) =>
    onChange({ ...value, providerId, modelId: modelsForProvider(providerId)[0]?.id ?? value.modelId });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showProfile && (
        <Select
          value={value.profileId ?? NO_PROFILE}
          onValueChange={(id) => {
            const p = id === NO_PROFILE ? undefined : getProfile(id);
            onChange(p ? valueFromProfile(p) : { ...value, profileId: undefined });
          }}
        >
          <SelectTrigger size="sm" className="min-w-36" aria-label="Profil">
            <span className="text-muted-foreground">Profil</span>
            <SelectValue />
            {modified && (
              <span className="text-warning" title="Profil modifié pour cette session">
                •
              </span>
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_PROFILE}>Aucun</SelectItem>
            {availableProfiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {p.scope.kind === "project" && <span className="text-[10px] text-muted-foreground">projet</span>}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={value.harnessId} onValueChange={(v) => setHarness(v as HarnessId)}>
        <SelectTrigger size="sm" className="min-w-36" aria-label="Harness">
          <span className="text-muted-foreground">Harness</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {harnesses.map((h) => (
            <SelectItem key={h.id} value={h.id}>
              {h.name}
              {!h.installed && <span className="text-[10px] text-muted-foreground">non installé</span>}
              {h.status === "outdated" && <span className="text-[10px] text-warning">obsolète</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={value.providerId} onValueChange={setProvider}>
        <SelectTrigger size="sm" className="min-w-36" aria-label="Provider">
          <span className="text-muted-foreground">Provider</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {providers.map((p) => {
            const v = checkProvider(value.harnessId, p.id);
            return (
              <SelectItem key={p.id} value={p.id}>
                <span className={v.status === "unsupported" ? "text-muted-foreground line-through" : undefined}>
                  {p.name}
                </span>
                {v.status !== "supported" && <CompatBadge verdict={v} compact />}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Select value={value.modelId} onValueChange={(modelId) => onChange({ ...value, modelId })}>
        <SelectTrigger size="sm" className="min-w-40" aria-label="Modèle">
          <span className="text-muted-foreground">Modèle</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{providers.find((p) => p.id === value.providerId)?.name}</SelectLabel>
            {modelsForProvider(value.providerId).map((m) => {
              const v = checkCombination({ ...value, modelId: m.id });
              return (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                  {v.status !== "supported" && <CompatBadge verdict={v} compact />}
                </SelectItem>
              );
            })}
          </SelectGroup>
        </SelectContent>
      </Select>

      {verdict.status !== "supported" && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CompatBadge verdict={verdict} />
          {verdict.reason}
        </span>
      )}
    </div>
  );
}
