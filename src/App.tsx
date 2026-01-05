import { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Twitter, Mail, ExternalLink, ArrowRight, ArrowLeft, Search, Moon, Sun, X } from 'lucide-react';
import Fuse from 'fuse.js';
import { getAllPosts, getPostBySlug, getFeaturedPost, getAllTags, getAllCategories, type Post } from './lib/posts';

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
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
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

const GridView = () => {
  const navigate = useNavigate();
  const posts = getAllPosts();
  const featuredPost = getFeaturedPost();
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
            <div className="pill" style={{ background: 'white' }}>BIO</div>
            <h2 style={{ fontSize: '2.5rem' }}>I'm Tinnci.</h2>
            <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>Senior student & Creative Developer.</p>
            <p style={{ marginTop: '1rem' }}>Focusing on the intersection of low-level systems and high-level design.</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <MotionA whileHover={{ y: -5 }} href="#" style={{ color: 'black' }}><Github size={24} /></MotionA>
            <MotionA whileHover={{ y: -5 }} href="#" style={{ color: 'black' }}><Twitter size={24} /></MotionA>
            <MotionA whileHover={{ y: -5 }} href="#" style={{ color: 'black' }}><Mail size={24} /></MotionA>
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
                style={{ background: 'white', cursor: 'pointer' }}
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
        <MotionDiv variants={item} className="bento-item bg-coral" style={{ color: 'white' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 900 }}>{posts.length}</h1>
          <p style={{ fontWeight: 800 }}>ARTICLES</p>
        </MotionDiv>

        {/* Projects */}
        <MotionDiv variants={item} className="bento-item bg-yellow">
          <h2 style={{ fontSize: '1.2rem' }}>Projects</h2>
          <p>UEFI Shell prototype in Rust.</p>
          <div style={{ marginTop: 'auto' }}><ExternalLink size={20} /></div>
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
