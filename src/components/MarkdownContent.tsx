import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MarkdownContentProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

export const MarkdownContent = ({ html, className = 'prose', style }: MarkdownContentProps) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let cancelled = false;

    const renderMermaid = async () => {
      const nodes = Array.from(el.querySelectorAll<HTMLElement>('pre.mermaid'));
      if (nodes.length === 0) return;

      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'neutral',
        securityLevel: 'loose',
        fontFamily: 'inherit',
      });

      for (const node of nodes) {
        const source = node.getAttribute('data-mermaid');
        if (source) {
          node.removeAttribute('data-processed');
          node.textContent = source;
        }
      }

      if (!cancelled) {
        await mermaid.run({ nodes });
      }
    };

    renderMermaid();

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.attributeName === 'data-theme') {
          renderMermaid();
          break;
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [html]);

  return (
    <article
      ref={containerRef}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
