import { useMemo } from "react";
import { marked } from "marked";

// Reports include scraped captions and URLs, so treat everything as untrusted:
// drop raw HTML and only allow http(s)/relative links and images.
const safe = (href: string) => (/^(https?:\/\/|\/|\.{0,2}\/|#|[\w-]+\.(md|png|jpe?g|webp)$)/i.test(href) ? href : "#");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
marked.use({
  renderer: {
    html: () => "",
    link({ href, tokens }) {
      return `<a href="${esc(safe(href))}" target="_blank" rel="noreferrer noopener">${this.parser.parseInline(tokens)}</a>`;
    },
    image({ href, text }) {
      return `<img src="${esc(safe(href))}" alt="${esc(text)}" />`;
    },
  },
});

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const html = useMemo(() => marked.parse(text || "", { async: false, gfm: true }) as string, [text]);
  return <div className={`prose-studio ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
