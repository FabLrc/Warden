import { useEffect, useRef } from "react";
import { links } from "@/lib/links";
import type { ReplayEvent } from "@/mock/replay";
import { diffStat } from "@/screens/work/conversation";
import type { InspectorFile } from "@/screens/work/session-inspector";

/** Esc interrupts the agent while it works (CDC §30: the user keeps control). */
export function useEscapeToInterrupt(active: boolean, interrupt: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) interrupt();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, interrupt]);
}

/**
 * Keeps a scroll container pinned to the bottom while its content grows (streaming),
 * unless the user scrolled up to read earlier messages.
 */
export function useAutoScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const observer = new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  return { scrollRef, contentRef, onScroll };
}

/** Files edited during a live run. Their diff is not recorded, so links open the file itself. */
export function liveFiles(projectId: string, events: ReplayEvent[]): InspectorFile[] {
  return events
    .filter((e) => e.kind === "file-edit" && e.status === "ok" && e.file && e.diff)
    .map((e) => ({
      path: e.file?.path ?? "",
      ...diffStat(e.diff ?? ""),
      href: links.code(projectId, { file: e.file?.path, line: e.file?.line, view: "file" }),
    }));
}
