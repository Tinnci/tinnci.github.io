import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Github, Twitter, Mail, ExternalLink, ArrowRight, ArrowLeft } from 'lucide-react';

const App = () => {
  const [view, setView] = useState<'grid' | 'post'>('grid');

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

  const thoughts = [
    { title: "Building a UEFI Environment", date: "Jan 03", color: "white" },
    { title: "The beauty of compact-risk architecture", date: "Dec 28", color: "var(--accent-3)" },
    { title: "Static sites are the future (again)", date: "Dec 15", color: "var(--accent-2)" },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      <AnimatePresence mode="wait">
        {view === 'grid' ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <header style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
              <motion.h1 style={{ fontSize: 'clamp(3rem, 10vw, 5rem)', fontWeight: 900, lineHeight: 1 }}>
                TINNCI<span style={{ color: 'var(--accent-1)' }}>.</span>IO
              </motion.h1>
              <p style={{ fontWeight: 700, marginTop: '1rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
                Digital Garden & Experimental Lab
              </p>
            </header>

            <motion.div
              className="bento-grid"
              variants={container}
              initial="hidden"
              animate="show"
            >
              <motion.div variants={item} className="bento-item span-2 row-2 bg-yellow">
                <div>
                  <div className="pill" style={{ background: 'white' }}>BIO</div>
                  <h2 style={{ fontSize: '2.5rem' }}>I'm Tinnci.</h2>
                  <p style={{ fontSize: '1.2rem', fontWeight: 600 }}>Senior student & Creative Developer.</p>
                  <p style={{ marginTop: '1rem' }}>Focusing on the intersection of low-level systems and high-level design.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <Github size={24} /> <Twitter size={24} /> <Mail size={24} />
                </div>
              </motion.div>

              <motion.div
                variants={item}
                className="bento-item span-2"
                onClick={() => setView('post')}
                style={{ cursor: 'pointer' }}
              >
                <div>
                  <div className="pill">FEATURED</div>
                  <h2>Modernizing my legacy Hexo blog to React</h2>
                  <p>A journey from a 5-year-old static site to a modern, dynamic experience.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', fontWeight: 900 }}>
                  READ MORE <ArrowRight size={18} />
                </div>
              </motion.div>

              <motion.div variants={item} className="bento-item bg-teal">
                <h2 style={{ fontSize: '1.2rem' }}>Stack</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {['React', 'Rust', 'Bun', 'Vite'].map(s => <span key={s} className="pill" style={{ background: 'white' }}>{s}</span>)}
                </div>
              </motion.div>

              <motion.div variants={item} className="bento-item bg-coral" style={{ color: 'white' }}>
                <h2 style={{ fontSize: '1.2rem' }}>Projects</h2>
                <p>UEFI Shell prototype in Rust.</p>
                <div style={{ marginTop: 'auto' }}><ExternalLink size={20} /></div>
              </motion.div>

              <motion.div variants={item} className="bento-item span-2">
                <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>Recent Thoughts</h2>
                {thoughts.map((t, i) => (
                  <div key={i} style={{ padding: '0.8rem', border: '3px solid black', margin: '0.3rem 0', background: t.color, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{t.title}</span> <span style={{ opacity: 0.5 }}>{t.date}</span>
                  </div>
                ))}
              </motion.div>

              <motion.div variants={item} className="bento-item bg-yellow">
                <h1 style={{ fontSize: '3rem', fontWeight: 900 }}>v2.0</h1>
                <p style={{ fontWeight: 800 }}>MIGRATE SUCCESS</p>
              </motion.div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="post"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}
          >
            <button
              onClick={() => setView('grid')}
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
            <div className="pill">JAN 05, 2026</div>
            <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 4rem)', fontWeight: 900, margin: '1rem 0', lineHeight: 1 }}>
              Modernizing my legacy Hexo blog to React
            </h1>
            <div style={{ borderBottom: '4px solid black', margin: '2rem 0' }} />
            <div style={{ fontSize: '1.2rem', lineHeight: 1.6, fontWeight: 500 }}>
              <p>Five years ago, I set up a Hexo blog. It served me well, but as I enter my final year of university, I felt the need for something that better represents my current technical skills...</p>
              <br />
              <div style={{ padding: '2rem', background: 'var(--accent-3)', border: '4px solid black', boxShadow: '8px 8px 0 black' }}>
                <h3 style={{ fontWeight: 900 }}>Placeholder for your article</h3>
                <p>I've set up this space for you. Once you provide the content, I'll help you format it with the same Neobrutalist aesthetic!</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer style={{ marginTop: '5rem', textAlign: 'center', paddingBottom: '3rem', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>
        TINNCI.IO © 2026 — BUILT WITH BUN ⚡
      </footer>
    </div>
  );
};

export default App;
