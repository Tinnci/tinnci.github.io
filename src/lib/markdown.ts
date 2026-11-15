import { marked, Renderer } from 'marked';
import * as yaml from 'js-yaml';

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const renderer = new Renderer();
const defaultCode = renderer.code.bind(renderer);

renderer.code = function (token) {
  if (token.lang?.trim().toLowerCase() === 'mermaid') {
    const code = token.text;
    return `<div class="mermaid-wrapper"><pre class="mermaid" data-mermaid="${escapeHtmlAttr(code)}">${escapeHtmlAttr(code)}</pre></div>`;
  }
  return defaultCode(token);
};

export function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, content: raw };
  }

  try {
    const data = (yaml.load(match[1]) as Record<string, unknown>) || {};
    return { data, content: match[2] };
  } catch {
    return { data: {}, content: raw };
  }
}

export function renderMarkdown(content: string): string {
  return marked(content, { renderer }) as string;
}
