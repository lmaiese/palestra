// Renders plan prose: one line per paragraph, "- x" bullets, "1. x" numbered items.
// "Label: value" at the start of a bullet gets the label emphasised.
import type { ReactNode } from 'react';

type Group = { kind: 'p'; lines: string[] } | { kind: 'ul'; lines: string[] } | { kind: 'ol'; lines: string[] };

function groupLines(lines: string[]): Group[] {
  const out: Group[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let kind: Group['kind'] = 'p';
    let text = line;
    if (/^[-*]\s+/.test(line)) {
      kind = 'ul';
      text = line.replace(/^[-*]\s+/, '');
    } else if (/^\d+\.\s+/.test(line)) {
      kind = 'ol';
      text = line.replace(/^\d+\.\s+/, '');
    }
    const last = out[out.length - 1];
    if (last && last.kind === kind && kind !== 'p') last.lines.push(text);
    else out.push({ kind, lines: [text] } as Group);
  }
  return out;
}

function labelled(text: string): ReactNode {
  const m = /^([^:]{2,40}):\s+(.+)$/.exec(text);
  if (!m) return text;
  return (
    <>
      <strong>{m[1]}</strong> {m[2]}
    </>
  );
}

export function RichText({ text, lines }: { text?: string; lines?: string[] }) {
  const groups = groupLines(lines ?? (text ?? '').split('\n'));
  return (
    <div className="rich">
      {groups.map((g, i) => {
        if (g.kind === 'p') return g.lines.map((l, j) => <p key={`${i}-${j}`}>{labelled(l)}</p>);
        const Tag = g.kind;
        return (
          <Tag key={i}>
            {g.lines.map((l, j) => (
              <li key={j}>{labelled(l)}</li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
