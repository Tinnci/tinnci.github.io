import matter from 'gray-matter';
import { marked } from 'marked';

export interface PostMeta {
    title: string;
    date: string;
    slug: string;
    featured: boolean;
    color: string;
    excerpt: string;
}

export interface Post extends PostMeta {
    content: string;
}

// Import all markdown files from content/posts
const postModules = import.meta.glob('/content/posts/*.md', {
    query: '?raw',
    import: 'default',
    eager: true
});

export function getAllPosts(): Post[] {
    const posts: Post[] = [];

    for (const path in postModules) {
        const raw = postModules[path] as string;
        const { data, content } = matter(raw);

        posts.push({
            title: data.title || 'Untitled',
            date: data.date || new Date().toISOString(),
            slug: data.slug || path.split('/').pop()?.replace('.md', '') || '',
            featured: data.featured || false,
            color: data.color || 'white',
            excerpt: data.excerpt || '',
            content: marked(content) as string,
        });
    }

    // Sort by date descending
    return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): Post | undefined {
    return getAllPosts().find(post => post.slug === slug);
}

export function getFeaturedPost(): Post | undefined {
    return getAllPosts().find(post => post.featured);
}
