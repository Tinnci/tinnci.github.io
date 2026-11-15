import { useEffect, useRef } from 'react';
import { mount } from 'pele';

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

    const nodes = Array.from(el.querySelectorAll<HTMLElement>('pre.mermaid'));
    for (const node of nodes) {
      const source = node.getAttribute('data-mermaid');
      if (source) {
        mount(node, source);
      }
    }
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
