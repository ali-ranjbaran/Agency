/**
 * Markdown → HTML for the Documents page. Raw HTML in the source is NOT rendered
 * (markdown-it `html: false`, its default; tags show as text). Headings get the same slug
 * anchors as shared/docs.ts, and {PLACEHOLDER} / [LAWYER] are wrapped in <mark>.
 */
import MarkdownIt from "markdown-it";
import { slugify } from "@shared/docs";

const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

const defaultText = md.renderer.rules.text!;
md.renderer.rules.text = (tokens, idx, opts, env, self) =>
  defaultText(tokens, idx, opts, env, self)
    .replace(/\{[A-Z][A-Z0-9_]*\}/g, (m) => `<mark class="doc-ph">${m}</mark>`)
    .replace(/\[LAWYER\]/g, '<mark class="doc-lawyer">[LAWYER]</mark>');

export function renderMarkdown(src: string) {
  const body = src.replace(/^---\n[\s\S]*?\n---\n/, "");
  const tokens = md.parse(body, {});
  const seen = new Map<string, number>();
  tokens.forEach((t, i) => {
    if (t.type === "heading_open") t.attrSet("id", slugify(tokens[i + 1]?.content ?? "", seen));
  });
  return md.renderer.render(tokens, md.options, {});
}
