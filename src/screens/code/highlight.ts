import { useEffect, useState } from "react";
import { createHighlighterCore, type HighlighterCore, type ThemedToken } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export type CodeLang = "typescript" | "tsx" | "json" | "markdown" | "css" | "rust";

const LANGUAGE_BY_EXT: Record<string, { lang?: CodeLang; label: string }> = {
  ts: { lang: "typescript", label: "TypeScript" },
  tsx: { lang: "tsx", label: "TypeScript JSX" },
  json: { lang: "json", label: "JSON" },
  md: { lang: "markdown", label: "Markdown" },
  css: { lang: "css", label: "CSS" },
  rs: { lang: "rust", label: "Rust" },
  sql: { label: "SQL" },
  toml: { label: "TOML" },
};

/** Files without a loaded grammar are shown as plain text. */
export function languageOf(path: string): { lang?: CodeLang; label: string } {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return LANGUAGE_BY_EXT[ext] ?? { label: "Texte brut" };
}

const THEME = "vitesse-dark";

let highlighter: Promise<HighlighterCore> | undefined;

/** Lazily created singleton, limited to the languages the prototype needs. */
function loadHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [import("shiki/themes/vitesse-dark.mjs")],
    langs: [
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/tsx.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/markdown.mjs"),
      import("shiki/langs/css.mjs"),
      import("shiki/langs/rust.mjs"),
    ],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter;
}

/** Tokenized lines; `undefined` while shiki loads or when the language has no grammar (render plain text). */
export function useHighlightedLines(code: string, lang: CodeLang | undefined): ThemedToken[][] | undefined {
  const [result, setResult] = useState<{ code: string; lang: CodeLang; tokens: ThemedToken[][] }>();
  useEffect(() => {
    if (!lang) return;
    let cancelled = false;
    loadHighlighter().then((h) => {
      if (!cancelled) setResult({ code, lang, tokens: h.codeToTokensBase(code, { lang, theme: THEME }) });
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);
  return result && result.code === code && result.lang === lang ? result.tokens : undefined;
}
