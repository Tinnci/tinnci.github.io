import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Mail, ExternalLink, ArrowRight, ArrowLeft, Search, Moon, Sun, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { getAllPosts, getPostBySlug, getFeaturedPost, getAllTags, getAllCategories, type Post } from './lib/posts';
import { getAllProjects, getFeaturedProjects } from './lib/projects';

// Fix for framer-motion v12+ type issues
const MotionDiv = motion.div as React.FC<React.HTMLAttributes<HTMLDivElement> & {
  initial?: object | string;
  animate?: object | string;
  exit?: object;
  variants?: object;
  whileHover?: object;
  whileTap?: object;
  transition?: object;
  key?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
}>;

const MotionH1 = motion.h1 as React.FC<React.HTMLAttributes<HTMLHeadingElement> & {
  style?: React.CSSProperties;
  children?: React.ReactNode;
}>;

const MotionA = motion.a as React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  whileHover?: object;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}>;

const PALETTES = [
  { a1: '#f472b6', a2: '#818cf8', a3: '#2dd4bf' }, // Cyberpunk (Pink, Indigo, Teal)
  { a1: '#34d399', a2: '#60a5fa', a3: '#fbbf24' }, // Forest (Emerald, Blue, Amber)
  { a1: '#a78bfa', a2: '#fb7185', a3: '#38bdf8' }, // Royal (Violet, Rose, Sky)
  { a1: '#fcd34d', a2: '#f87171', a3: '#c084fc' }, // Candy (Amber, Red, Purple)
  { a1: '#22d3ee', a2: '#818cf8', a3: '#c084fc' }, // Ocean (Cyan, Indigo, Purple)
  { a1: '#fb923c', a2: '#db2777', a3: '#4f46e5' }, // Sunset (Orange, Pink, Indigo)
  { a1: '#94a3b8', a2: '#334155', a3: '#0f172a' }, // Slate (Light Slate, Dark Slate, Navy)
  { a1: '#5eead4', a2: '#0d9488', a3: '#115e59' }, // Mint (Mint, Teal, Dark Teal)
  { a1: '#fca5a5', a2: '#f87171', a3: '#ef4444' }, // Monochromatic Red
  { a1: '#bef264', a2: '#65a30d', a3: '#3f6212' }, // Lime/Matcha
  { a1: '#67e8f9', a2: '#06b6d4', a3: '#155e75' }, // Sky/Deep Sea
];

// Theme Toggle Component
const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');

    if (isDark) {
      const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      root.style.setProperty('--raw-accent-1', palette.a1);
      root.style.setProperty('--raw-accent-2', palette.a2);
      root.style.setProperty('--raw-accent-3', palette.a3);
    } else {
      // Reset to default neobrutalist bright colors in light mode
      root.style.removeProperty('--raw-accent-1');
      root.style.removeProperty('--raw-accent-2');
      root.style.removeProperty('--raw-accent-3');
    }
  }, [isDark]);

  return (
    <button className="theme-toggle" onClick={() => setIsDark(!isDark)}>
      {isDark ? <Sun size={24} /> : <Moon size={24} />}
    </button>
  );
};

// Search Component
const SearchBox = ({ posts }: { posts: Post[] }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const fuse = useMemo(() => new Fuse(posts, {
    keys: ['title', 'excerpt', 'tags', 'category'],
    threshold: 0.3,
  }), [posts]);

  const results = query ? fuse.search(query).slice(0, 5) : [];

  return (
    <div style={{ position: 'relative', marginBottom: '2rem' }}>
      <div style={{ position: 'relative' }}>
        <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
        <input
          type="text"
          className="search-input"
          placeholder="Search articles..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          style={{ paddingLeft: '3rem' }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); }}
            style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div className="search-results">
          {results.map(({ item }) => (
            <div
              key={item.slug}
              className="search-result-item"
              onClick={() => { navigate(`/post/${item.slug}`); setQuery(''); setIsOpen(false); }}
            >
              <div style={{ fontWeight: 800 }}>{item.title}</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>{item.excerpt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectsView = () => {
  const navigate = useNavigate();
  const projects = getAllProjects();

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{ padding: '2rem 0' }}
    >
      <button
        onClick={() => navigate('/')}
        className="pill"
        style={{ marginBottom: '2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
      >
        <ArrowLeft size={18} /> BACK HOME
      </button>

      <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '2rem' }}>PROJECTS</h1>

      <div className="bento-grid">
        {projects.map((project) => (
          <MotionDiv
            key={project.slug}
            whileHover={{ y: -5 }}
            className="bento-item span-2"
            onClick={() => navigate(`/project/${project.slug}`)}
            style={{ cursor: 'pointer' }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="pill">{project.status}</div>
              </div>
              <h2 style={{ marginTop: '1rem' }}>{project.title}</h2>
              <p>{project.description}</p>
              <div className="tag-cloud" style={{ marginTop: '1rem' }}>
                {project.tags.map((tag: string) => (
                  <span key={tag} className="pill" style={{ opacity: 0.7, fontSize: '0.7rem' }}>{tag}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', fontWeight: 900 }}>
              VIEW DETAILS <ArrowRight size={18} />
            </div>
          </MotionDiv>
        ))}
      </div>
    </MotionDiv>
  );
};

const ProjectDetailView = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const projects = getAllProjects();
  const project = projects.find(p => p.slug === slug);

  if (!project) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <h1>Project not found</h1>
        <button onClick={() => navigate('/projects')}>Back to Projects</button>
      </div>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}
    >
      <button
        onClick={() => navigate('/projects')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 900,
          marginBottom: '2rem',
          color: 'var(--fg)'
        }}
      >
        <ArrowLeft size={24} /> BACK TO PROJECTS
      </button>

      <div style={{ marginBottom: '1rem' }}>
        <span className="pill">{project.status}</span>
        {project.link && project.link !== '#' && (
          <a
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            className="pill"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none', color: 'inherit' }}
          >
            <ExternalLink size={14} /> View on GitHub
          </a>
        )}
      </div>

      <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, margin: '1rem 0', lineHeight: 1.1 }}>
        {project.title}
      </h1>

      <p style={{ fontSize: '1.2rem', opacity: 0.8, marginBottom: '1.5rem' }}>{project.description}</p>

      <div style={{ marginBottom: '1.5rem' }}>
        {project.tags.map((tag: string) => (
          <span key={tag} className="pill" style={{ fontSize: '0.75rem' }}>{tag}</span>
        ))}
      </div>

      <div style={{ borderBottom: '4px solid var(--border)', margin: '1.5rem 0' }} />

      <article
        className="prose"
        style={{ fontSize: '1.1rem', lineHeight: 1.8, fontWeight: 500 }}
        dangerouslySetInnerHTML={{ __html: project.content }}
      />
    </MotionDiv>
  );
};

const GridView = () => {
  const navigate = useNavigate();
  const posts = getAllPosts();
  const featuredPost = getFeaturedPost();
  const featuredProjects = getFeaturedProjects();
  const tags = getAllTags();
  const categories = getAllCategories();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredPosts = useMemo(() => {
    let result = posts;
    if (selectedTag) {
      result = result.filter(p => p.tags.includes(selectedTag));
    }
    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }
    return result;
  }, [posts, selectedTag, selectedCategory]);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: {
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 120 }
    }
  };

  const recentPosts = filteredPosts.filter(p => !p.featured).slice(0, 5);

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <header style={{ textAlign: 'center', marginBottom: '3rem', marginTop: '2rem' }}>
        <MotionH1 style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', fontWeight: 900, lineHeight: 1 }}>
          TINNCI<span style={{ color: 'var(--accent-1)' }}>.</span>IO
        </MotionH1>
        <p style={{ fontWeight: 700, marginTop: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
          Digital Garden & Experimental Lab
        </p>
      </header>

      <SearchBox posts={posts} />

      <MotionDiv
        className="bento-grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Bio Card */}
        <MotionDiv variants={item} className="bento-item span-2 row-2 bg-yellow">
          <div>
            <div className="pill">BIO</div>
            <h2 style={{ fontSize: '2.5rem' }}>I'm Tinnci.</h2>
            <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>Senior student & Creative Developer.</p>
            <p style={{ marginTop: '1rem' }}>Focusing on the intersection of low-level systems and high-level design.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <MotionA whileHover={{ y: -5 }} href="https://github.com/Tinnci/" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}><Github size={24} /></MotionA>
            <MotionA whileHover={{ y: -5 }} href="#" style={{ color: 'inherit' }}><Mail size={24} /></MotionA>
          </div>
        </MotionDiv>

        {/* Featured Post */}
        {featuredPost && !selectedTag && !selectedCategory && (
          <MotionDiv
            variants={item}
            className="bento-item span-2"
            onClick={() => navigate(`/post/${featuredPost.slug}`)}
            style={{ cursor: 'pointer' }}
          >
            <div>
              <div className="pill">FEATURED</div>
              <h2>{featuredPost.title}</h2>
              <p>{featuredPost.excerpt}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', fontWeight: 900 }}>
              READ MORE <ArrowRight size={18} />
            </div>
          </MotionDiv>
        )}

        {/* Categories */}
        <MotionDiv variants={item} className="bento-item bg-teal">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Categories</h2>
          <div className="tag-cloud">
            {categories.map(({ category, count }) => (
              <span
                key={category}
                className={`pill ${selectedCategory === category ? 'active' : ''}`}
                onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                style={{ cursor: 'pointer' }}
              >
                {category} ({count})
              </span>
            ))}
          </div>
        </MotionDiv>

        {/* Tags */}
        <MotionDiv variants={item} className="bento-item">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Tags</h2>
          <div className="tag-cloud">
            {tags.slice(0, 6).map(({ tag, count }) => (
              <span
                key={tag}
                className={`pill ${selectedTag === tag ? 'active' : ''}`}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                style={{ cursor: 'pointer' }}
              >
                {tag} ({count})
              </span>
            ))}
          </div>
        </MotionDiv>

        {/* Posts List */}
        <MotionDiv variants={item} className="bento-item span-2">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>
            {selectedTag || selectedCategory ? `Filtered Posts` : 'Recent Posts'}
            {(selectedTag || selectedCategory) && (
              <button
                onClick={() => { setSelectedTag(null); setSelectedCategory(null); }}
                style={{ marginLeft: '1rem', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Clear
              </button>
            )}
          </h2>
          {recentPosts.length > 0 ? (
            recentPosts.map((post) => (
              <div
                key={post.slug}
                className="post-item"
                onClick={() => navigate(`/post/${post.slug}`)}
              >
                <div>
                  <span style={{ fontWeight: 800 }}>{post.title}</span>
                  <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '0.25rem' }}>
                    {post.category} • {post.tags.slice(0, 2).join(', ')}
                  </div>
                </div>
                <span style={{ opacity: 0.5, fontSize: '0.85rem' }}>
                  {new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))
          ) : (
            <p style={{ opacity: 0.6 }}>No posts found.</p>
          )}
        </MotionDiv>

        {/* Stats */}
        <MotionDiv variants={item} className="bento-item bg-coral">
          <h1 style={{ fontSize: '3rem', fontWeight: 900 }}>{posts.length}</h1>
          <p style={{ fontWeight: 800 }}>ARTICLES</p>
        </MotionDiv>

        {/* Projects */}
        <MotionDiv
          variants={item}
          className="bento-item bg-yellow"
          onClick={() => navigate('/projects')}
          style={{ cursor: 'pointer' }}
        >
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>Projects</h2>
            {featuredProjects.length > 0 ? (
              <div>
                <p style={{ fontWeight: 800 }}>{featuredProjects[0].title}</p>
                <p style={{ fontSize: '0.9rem' }}>{featuredProjects[0].description}</p>
              </div>
            ) : (
              <p>Check out my latest experimental works.</p>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontWeight: 900, fontSize: '0.8rem' }}>VIEW ALL</span>
            <ArrowRight size={20} />
          </div>
        </MotionDiv>
      </MotionDiv>
    </MotionDiv>
  );
};

const PostView = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <h1>Post not found</h1>
        <button onClick={() => navigate('/')}>Back to Home</button>
      </div>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}
    >
      <button
        onClick={() => navigate('/')}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 900,
          marginBottom: '2rem',
          color: 'var(--fg)'
        }}
      >
        <ArrowLeft size={24} /> BACK
      </button>

      <div style={{ marginBottom: '1rem' }}>
        <span className="pill">{post.category}</span>
        <span className="pill">{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>

      <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, margin: '1rem 0', lineHeight: 1.1 }}>
        {post.title}
      </h1>

      <div style={{ marginBottom: '1.5rem' }}>
        {post.tags.map(tag => (
          <span key={tag} className="pill" style={{ fontSize: '0.75rem' }}>{tag}</span>
        ))}
      </div>

      <div style={{ borderBottom: '4px solid var(--border)', margin: '1.5rem 0' }} />

      <article
        className="prose"
        style={{ fontSize: '1.1rem', lineHeight: 1.8, fontWeight: 500 }}
        dangerouslySetInnerHTML={{ __html: post.content }}
      />
    </MotionDiv>
  );
};

const App = () => {
  return (
    <>
      <ThemeToggle />
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<GridView />} />
            <Route path="/post/:slug" element={<PostView />} />
            <Route path="/projects" element={<ProjectsView />} />
            <Route path="/project/:slug" element={<ProjectDetailView />} />
          </Routes>
        </AnimatePresence>

        <footer style={{ marginTop: '5rem', textAlign: 'center', paddingBottom: '3rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>
          TINNCI.IO © 2026 — BUILT WITH BUN ⚡
        </footer>
      </div>
    </>
  );
};

export default App;
