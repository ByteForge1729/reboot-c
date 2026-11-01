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
    "&": { backgroundColor: "#0f0f0f", color: "#f2f2ee", fontSize: "14px", borderRadius: "6px", border: "1px solid #2c312c" },
    "&.cm-focused": { outline: "none", borderColor: "#337418", boxShadow: "0 0 0 3px rgba(93, 214, 44, 0.28)" },
    ".cm-scroller": { fontFamily: '"IBM Plex Mono", ui-monospace, monospace', lineHeight: "1.6", minHeight: "320px" },
    ".cm-content": { caretColor: "#5dd62c", padding: "12px 0" },
    ".cm-cursor": { borderLeftColor: "#5dd62c", borderLeftWidth: "2px" },
    ".cm-gutters": { backgroundColor: "#181a18", color: "#5f675f", border: "none", borderRight: "1px solid #2c312c" },
    ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.03)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(93, 214, 44, 0.08)", color: "#9ba39b" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "rgba(108, 182, 255, 0.25)" },
    ".cm-matchingBracket": { backgroundColor: "rgba(93, 214, 44, 0.2)", outline: "none" },
    ".cm-tooltip": { backgroundColor: "#202020", border: "1px solid #2c312c" },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.controlKeyword, tags.typeName, tags.modifier], color: "#6cb6ff" },
  { tag: [tags.string, tags.character], color: "#5dd62c" },
  { tag: [tags.number, tags.bool], color: "#f5b83d" },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: "#7c857c", fontStyle: "italic" },
  { tag: [tags.processingInstruction, tags.macroName], color: "#c792ea" },
  { tag: [tags.function(tags.variableName)], color: "#f2f2ee", fontWeight: "600" },
  { tag: tags.escape, color: "#f5b83d" },
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
