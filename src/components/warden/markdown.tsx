import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

/** Agent / prompt text. Raw HTML is not rendered (react-markdown default). */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "space-y-2 text-sm leading-relaxed",
        "[&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-soul",
        "[&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-surface [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_strong]:font-semibold [&_strong]:text-foreground [&_em]:text-muted-foreground",
        "[&_h1]:text-base [&_h1]:font-semibold [&_h2]:font-semibold",
        "[&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline",
        className,
      )}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
