import { Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Twitter, Mail, ExternalLink, ArrowRight, ArrowLeft } from 'lucide-react';
import { getAllPosts, getPostBySlug, getFeaturedPost } from './lib/posts';

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

const GridView = () => {
  const navigate = useNavigate();
  const posts = getAllPosts();
  const featuredPost = getFeaturedPost();

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

  // Get recent posts (excluding featured)
  const recentPosts = posts.filter(p => !p.featured).slice(0, 3);

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <header style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
        <MotionH1 style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', fontWeight: 900, lineHeight: 1 }}>
          TINNCI<span style={{ color: 'var(--accent-1)' }}>.</span>IO
        </MotionH1>
        <p style={{ fontWeight: 700, marginTop: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
          Digital Garden & Experimental Lab
        </p>
      </header>

      <MotionDiv
        className="bento-grid"
        variants={container}
        initial="hidden"
        animate="show"
      >
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

        {/* Featured Post - Dynamic */}
        {featuredPost && (
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

        <MotionDiv variants={item} className="bento-item bg-teal">
          <h2 style={{ fontSize: '1.2rem' }}>Stack</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
            {['React', 'Rust', 'Bun', 'Vite'].map(s => <span key={s} className="pill" style={{ background: 'white' }}>{s}</span>)}
          </div>
        </MotionDiv>

        <MotionDiv variants={item} className="bento-item bg-coral" style={{ color: 'white' }}>
          <h2 style={{ fontSize: '1.2rem' }}>Projects</h2>
          <p>UEFI Shell prototype in Rust.</p>
          <div style={{ marginTop: 'auto' }}><ExternalLink size={20} /></div>
        </MotionDiv>

        {/* Recent Posts - Dynamic */}
        <MotionDiv variants={item} className="bento-item span-2">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Recent Thoughts</h2>
          {recentPosts.map((post) => (
            <div
              key={post.slug}
              onClick={() => navigate(`/post/${post.slug}`)}
              style={{
                padding: '0.8rem',
                border: '3px solid black',
                margin: '0.3rem 0',
                background: post.color,
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                cursor: 'pointer'
              }}
            >
              <span>{post.title}</span>
              <span style={{ opacity: 0.5 }}>{new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          ))}
        </MotionDiv>

        <MotionDiv variants={item} className="bento-item bg-yellow">
          <h1 style={{ fontSize: '3rem', fontWeight: 900 }}>{posts.length}</h1>
          <p style={{ fontWeight: 800 }}>ARTICLES</p>
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
          marginBottom: '3rem'
        }}
      >
        <ArrowLeft size={24} /> BACK TO GRID
      </button>
      <div className="pill">{new Date(post.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
      <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', fontWeight: 900, margin: '1rem 0', lineHeight: 1 }}>
        {post.title}
      </h1>
      <div style={{ borderBottom: '4px solid black', margin: '2rem 0' }} />
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
  );
};

export default App;
