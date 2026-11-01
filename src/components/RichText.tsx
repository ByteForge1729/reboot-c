type Props = { text: string };

function Bold({ text }: Props) {
  return <>{text.split("**").map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}</>;
}

/** One line with `backticks` as inline code and **double stars** as bold. Plain React text: no HTML injection. */
export function InlineCode({ text }: Props) {
  return <>{text.split("`").map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : <Bold key={i} text={part} />))}</>;
}

/** Paragraphs split on blank lines, single newlines kept, `backticks` as inline code. */
export function RichText({ text }: Props) {
  return (
    <>
      {text.split(/\n{2,}/).map((paragraph, p) => (
        <p key={p}>
          {paragraph.split("\n").map((line, l) => (
            <span key={l}>
              {l > 0 && <br />}
              <InlineCode text={line} />
            </span>
          ))}
        </p>
      ))}
    </>
  );
}
