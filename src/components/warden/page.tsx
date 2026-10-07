import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InspectorState {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const InspectorContext = createContext<InspectorState | null>(null);

/** Inspector visibility is global so it persists across navigation. */
export function InspectorProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return <InspectorContext.Provider value={{ open, setOpen }}>{children}</InspectorContext.Provider>;
}

function useInspector(): InspectorState {
  const ctx = useContext(InspectorContext);
  if (!ctx) throw new Error("useInspector outside InspectorProvider");
  return ctx;
}

/**
 * Standard screen frame: header + scrollable body + optional right inspector.
 * Set `bodyClassName="p-0 overflow-hidden"` for screens that manage their own scrolling.
 */
export function Page({
  title,
  subtitle,
  actions,
  inspector,
  inspectorTitle = "Inspecteur",
  children,
  bodyClassName,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  inspector?: ReactNode;
  inspectorTitle?: string;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const { open, setOpen } = useInspector();
  const showInspector = Boolean(inspector) && open;
  return (
    <div className="flex h-full min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 shrink-0 items-center gap-3 border-b border-border px-6 py-2">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>
            {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {inspector && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setOpen(!open)}
                aria-label={open ? "Masquer l'inspecteur" : "Afficher l'inspecteur"}
                title={open ? "Masquer l'inspecteur" : "Afficher l'inspecteur"}
              >
                {open ? <PanelRightClose /> : <PanelRightOpen />}
              </Button>
            )}
          </div>
        </header>
        <div className={cn("min-h-0 flex-1 overflow-auto bg-sculk p-6", bodyClassName)}>{children}</div>
      </div>
      {showInspector && (
        <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-surface">
          <div className="flex h-14 shrink-0 items-center border-b border-border px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {inspectorTitle}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">{inspector}</div>
        </aside>
      )}
    </div>
  );
}

export function Section({
  title,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="text-muted-foreground [&>svg]:size-6">{icon}</div>}
      <div className="text-sm font-medium">{title}</div>
      {children && <div className="max-w-md text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Label/value rows for inspectors and detail panels. */
export function KeyValue({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  );
}
