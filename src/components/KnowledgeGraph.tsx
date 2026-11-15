import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllPosts } from '../lib/posts';
import { getAllProjects } from '../lib/projects';

type NodeKind = 'post' | 'project' | 'tag';

interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  slug?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

export const KnowledgeGraph = () => {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showTags, setShowTags] = useState(true);
  const hoveredRef = useRef<string | null>(null);
  const dragRef = useRef<{ id: string | null; moved: boolean }>({ id: null, moved: false });

  const { initialNodes, edges, neighborMap } = useMemo(() => {
    const posts = getAllPosts();
    const projects = getAllProjects();

    const nodeMap = new Map<string, GraphNode>();
    const edgeList: GraphEdge[] = [];
    const neighbors = new Map<string, Set<string>>();

    const addNeighbor = (a: string, b: string) => {
      if (!neighbors.has(a)) neighbors.set(a, new Set());
      if (!neighbors.has(b)) neighbors.set(b, new Set());
      neighbors.get(a)!.add(b);
      neighbors.get(b)!.add(a);
    };

    const ensureTag = (tag: string) => {
      const id = `tag:${tag.toLowerCase()}`;
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          label: `#${tag}`,
          kind: 'tag',
          x: (Math.random() - 0.5) * 400,
          y: (Math.random() - 0.5) * 260,
          vx: 0,
          vy: 0,
          degree: 0,
        });
      }
      return id;
    };

    posts.forEach((p, idx) => {
      const id = `post:${p.slug}`;
      const angle = (idx / Math.max(1, posts.length)) * Math.PI * 2;
      nodeMap.set(id, {
        id,
        label: p.title,
        kind: 'post',
        slug: p.slug,
        x: Math.cos(angle) * 180,
        y: Math.sin(angle) * 140,
        vx: 0,
        vy: 0,
        degree: p.tags.length,
      });

      p.tags.forEach((t) => {
        const tagId = ensureTag(t);
        edgeList.push({ source: id, target: tagId });
        addNeighbor(id, tagId);
        nodeMap.get(tagId)!.degree += 1;
      });
    });

    projects.forEach((proj, idx) => {
      const id = `project:${proj.slug}`;
      const angle = (idx / Math.max(1, projects.length)) * Math.PI * 2 + 0.4;
      nodeMap.set(id, {
        id,
        label: proj.title,
        kind: 'project',
        slug: proj.slug,
        x: Math.cos(angle) * 240,
        y: Math.sin(angle) * 180,
        vx: 0,
        vy: 0,
        degree: proj.tags.length,
      });

      proj.tags.forEach((t) => {
        const tagId = ensureTag(t);
        edgeList.push({ source: id, target: tagId });
        addNeighbor(id, tagId);
        nodeMap.get(tagId)!.degree += 1;
      });
    });

    return {
      initialNodes: Array.from(nodeMap.values()),
      edges: edgeList,
      neighborMap: neighbors,
    };
  }, []);

  const nodesRef = useRef<GraphNode[]>([]);
  useEffect(() => {
    nodesRef.current = initialNodes.map((n) => ({ ...n }));
  }, [initialNodes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = 800;
    let height = 560;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width || 800;
      height = rect.height || 560;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const getThemeColors = () => {
      const styles = getComputedStyle(document.documentElement);
      return {
        bg: styles.getPropertyValue('--card-bg').trim() || '#ffffff',
        fg: styles.getPropertyValue('--fg').trim() || '#111111',
        border: styles.getPropertyValue('--border').trim() || '#000000',
        post: '#ff6b6b',
        project: '#ffd93d',
        tag: '#6bcb77',
      };
    };

    const tick = () => {
      const nodes = nodesRef.current.filter((n) => showTags || n.kind !== 'tag');
      const visibleIds = new Set(nodes.map((n) => n.id));
      const nodeById = new Map(nodes.map((n) => [n.id, n]));

      // Force simulation (repulsion + center gravity + spring edges)
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (dragRef.current.id === a.id) continue;

        // Gentle center pull
        a.vx += -a.x * 0.0022;
        a.vy += -a.y * 0.0022;

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = dx * dx + dy * dy + 1;
          const dist = Math.sqrt(distSq);
          const force = 1600 / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          if (dragRef.current.id !== b.id) {
            b.vx -= fx;
            b.vy -= fy;
          }
        }
      }

      if (showTags) {
        for (const e of edges) {
          const a = nodeById.get(e.source);
          const b = nodeById.get(e.target);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 95;
          const strength = (dist - targetDist) * 0.018;
          const fx = (dx / dist) * strength;
          const fy = (dy / dist) * strength;
          if (dragRef.current.id !== a.id) {
            a.vx += fx;
            a.vy += fy;
          }
          if (dragRef.current.id !== b.id) {
            b.vx -= fx;
            b.vy -= fy;
          }
        }
      }

      for (const n of nodes) {
        if (dragRef.current.id === n.id) continue;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      }

      const colors = getThemeColors();
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width / 2, height / 2);

      const activeId = hoveredRef.current;
      const activeNeighbors = activeId ? neighborMap.get(activeId) : null;

      // Draw edges
      if (showTags) {
        for (const e of edges) {
          if (!visibleIds.has(e.source) || !visibleIds.has(e.target)) continue;
          const a = nodeById.get(e.source)!;
          const b = nodeById.get(e.target)!;
          const isHighlighted = activeId && (e.source === activeId || e.target === activeId);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = colors.fg;
          ctx.globalAlpha = activeId ? (isHighlighted ? 0.85 : 0.08) : 0.22;
          ctx.lineWidth = isHighlighted ? 2 : 1;
          ctx.stroke();
        }
      }

      // Draw nodes
      for (const n of nodes) {
        const isSelf = activeId === n.id;
        const isNeighbor = activeNeighbors?.has(n.id) ?? false;
        const dimmed = Boolean(activeId && !isSelf && !isNeighbor);
        const radius = n.kind === 'tag' ? 5 + Math.min(4, n.degree) : 9 + Math.min(4, n.degree * 0.5);

        ctx.globalAlpha = dimmed ? 0.2 : 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = n.kind === 'post' ? colors.post : n.kind === 'project' ? colors.project : colors.tag;
        ctx.fill();
        ctx.lineWidth = isSelf ? 3 : 2;
        ctx.strokeStyle = colors.border;
        ctx.stroke();

        // Label
        if (n.kind !== 'tag' || isSelf || isNeighbor || !activeId) {
          ctx.font = `${isSelf ? '800' : '600'} ${n.kind === 'tag' ? '11px' : '12px'} system-ui, sans-serif`;
          ctx.fillStyle = colors.fg;
          ctx.textAlign = 'center';
          const shortLabel = n.label.length > 26 ? `${n.label.slice(0, 24)}…` : n.label;
          ctx.fillText(shortLabel, n.x, n.y + radius + 14);
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [edges, neighborMap, showTags]);

  const findNodeAt = (clientX: number, clientY: number): GraphNode | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;

    const nodes = nodesRef.current.filter((n) => showTags || n.kind !== 'tag');
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = cx - n.x;
      const dy = cy - n.y;
      if (dx * dx + dy * dy <= 18 * 18) return n;
    }
    return null;
  };

  return (
    <div style={{ padding: '2rem 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/')} className="btn-brutal btn-danger-brutal">
          ← BACK TO HOME
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span className="pill" style={{ background: '#ff6b6b', color: '#000' }}>● Articles</span>
          <span className="pill" style={{ background: '#ffd93d', color: '#000' }}>● Projects</span>
          <span className="pill" style={{ background: '#6bcb77', color: '#000' }}>● Tags</span>
          <button
            onClick={() => setShowTags((s) => !s)}
            className="btn-brutal"
            style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
          >
            {showTags ? 'HIDE TAG NODES' : 'SHOW TAG NODES'}
          </button>
        </div>
      </div>

      <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '0.5rem' }}>KNOWLEDGE GRAPH</h1>
      <p style={{ opacity: 0.75, marginBottom: '1.5rem', fontWeight: 600 }}>
        Obsidian-style force graph linking articles, projects, and shared tags. Drag nodes or click an article/project to open it.
      </p>

      <div
        className="bento-item"
        style={{ padding: 0, overflow: 'hidden', height: '560px', position: 'relative' }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', display: 'block', cursor: hoveredId ? 'pointer' : 'grab' }}
          onMouseMove={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            if (dragRef.current.id) {
              const rect = canvas.getBoundingClientRect();
              const node = nodesRef.current.find((n) => n.id === dragRef.current.id);
              if (node) {
                node.x = e.clientX - rect.left - rect.width / 2;
                node.y = e.clientY - rect.top - rect.height / 2;
                node.vx = 0;
                node.vy = 0;
                dragRef.current.moved = true;
              }
              return;
            }
            const hit = findNodeAt(e.clientX, e.clientY);
            const nextId = hit ? hit.id : null;
            if (hoveredRef.current !== nextId) {
              hoveredRef.current = nextId;
              setHoveredId(nextId);
            }
          }}
          onMouseDown={(e) => {
            const hit = findNodeAt(e.clientX, e.clientY);
            if (hit) {
              dragRef.current = { id: hit.id, moved: false };
            }
          }}
          onMouseUp={(e) => {
            const dragged = dragRef.current;
            dragRef.current = { id: null, moved: false };
            if (!dragged.moved) {
              const hit = findNodeAt(e.clientX, e.clientY);
              if (hit?.kind === 'post' && hit.slug) navigate(`/post/${hit.slug}`);
              if (hit?.kind === 'project' && hit.slug) navigate(`/project/${hit.slug}`);
            }
          }}
          onMouseLeave={() => {
            dragRef.current = { id: null, moved: false };
            hoveredRef.current = null;
            setHoveredId(null);
          }}
        />
      </div>
    </div>
  );
};
