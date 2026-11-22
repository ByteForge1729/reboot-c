import { useEffect, useRef } from "react";
import { cpp } from "@codemirror/lang-cpp";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup } from "codemirror";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
};

// Palette tokens from spec/SUMMARY.md; CodeMirror needs concrete values inside its theme.
const theme = EditorView.theme(
  {
    "&": { backgroundColor: "var(--bg)", color: "var(--text)", fontSize: "14px", borderRadius: "6px", border: "1px solid var(--line)" },
    "&.cm-focused": { outline: "none", borderColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-glow)" },
    ".cm-scroller": { fontFamily: '"IBM Plex Mono", ui-monospace, monospace', lineHeight: "1.6", minHeight: "320px" },
    ".cm-content": { caretColor: "var(--accent)", padding: "12px 0" },
    ".cm-cursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
    ".cm-gutters": { backgroundColor: "var(--surface)", color: "var(--muted)", border: "none", borderRight: "1px solid var(--line)" },
    ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.03)" },
    ".cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--text)" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "color-mix(in srgb, var(--signal) 28%, transparent)" },
    ".cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--accent) 25%, transparent)", outline: "none" },
    ".cm-tooltip": { backgroundColor: "var(--raised)", border: "1px solid var(--line)" },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.typeName, tags.modifier], color: "var(--signal)" },
  { tag: [tags.string, tags.character], color: "var(--warn)" },
  { tag: [tags.number, tags.bool], color: "var(--accent-soft)" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "var(--muted)", fontStyle: "italic" },
  { tag: [tags.processingInstruction, tags.macroName], color: "#c792ea" },
  { tag: [tags.function(tags.variableName)], color: "var(--text)", fontWeight: "600" },
  { tag: tags.escape, color: "var(--accent-soft)" },
]);

/** CodeMirror 6 C editor. Owns its own document; reports every change through onChange. */
export function CodeEditor({ value, onChange, label }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      doc: value,
      extensions: [
        basicSetup,
        cpp(),
        theme,
        syntaxHighlighting(highlight),
        EditorView.contentAttributes.of({ "aria-label": label, spellcheck: "false" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // Created once per mount (value is only the initial doc); external value changes are synced below.
  }, [label]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  return <div ref={host} className="code-editor" />;
}
