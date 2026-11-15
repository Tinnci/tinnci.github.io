import { useEffect, useRef } from 'react';
import { mount, type Mounted } from 'pele';

interface MarkdownContentProps {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}

const DIAGRAM_FONT_FAMILY = "'Outfit', 'Inter', system-ui, -apple-system, sans-serif";

export const MarkdownContent = ({ html, className = 'prose', style }: MarkdownContentProps) => {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mounted: Mounted[] = [];
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('pre.mermaid'));
    for (const node of nodes) {
      const source = node.getAttribute('data-mermaid');
      if (source) {
        mounted.push(
          mount(node, source, {
            fontFamily: DIAGRAM_FONT_FAMILY,
            fontSize: 15,
            responsive: true,
          })
        );
      }
    }

    return () => {
      for (const m of mounted) {
        m.destroy();
      }
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
