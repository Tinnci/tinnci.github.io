import { marked } from 'marked';
import * as yaml from 'js-yaml';

export interface PostMeta {
    title: string;
    date: string;
    slug: string;
    featured: boolean;
    color: string;
    excerpt: string;
    category: string;
    tags: string[];
}

export interface Post extends PostMeta {
    content: string;
}

// Simple frontmatter parser (browser compatible)
function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) {
        return { data: {}, content: raw };
    }

    try {
        const data = yaml.load(match[1]) as Record<string, unknown>;
        return { data, content: match[2] };
    } catch {
        return { data: {}, content: raw };
    }
}

// Import all markdown files from content/posts
const postModules = import.meta.glob('/content/posts/*.md', {
    query: '?raw',
    import: 'default',
    eager: true
});

// Singleton cache for parsed posts
let cachedPosts: Post[] | null = null;

export function getAllPosts(): Post[] {
    if (cachedPosts) return cachedPosts;

    const posts: Post[] = [];

    for (const path in postModules) {
        const raw = postModules[path] as string;
        const { data, content } = parseFrontmatter(raw);

        posts.push({
            title: (data.title as string) || 'Untitled',
            date: (data.date as string) || new Date().toISOString(),
            slug: (data.slug as string) || path.split('/').pop()?.replace('.md', '') || '',
            featured: (data.featured as boolean) || false,
            color: (data.color as string) || 'white',
            excerpt: (data.excerpt as string) || '',
            category: (data.category as string) || 'Uncategorized',
            tags: (data.tags as string[]) || [],
            content: marked(content) as string,
        });
    }

    // Sort by date descending and cache the result
    cachedPosts = posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return cachedPosts;
}

export function getPostBySlug(slug: string): Post | undefined {
    return getAllPosts().find(post => post.slug === slug);
}

export function getFeaturedPost(): Post | undefined {
    return getAllPosts().find(post => post.featured);
}

export function getAllTags(): { tag: string; count: number }[] {
    const tagMap = new Map<string, number>();

    getAllPosts().forEach(post => {
        post.tags.forEach(tag => {
            tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });
    });

    return Array.from(tagMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
}

export function getAllCategories(): { category: string; count: number }[] {
    const categoryMap = new Map<string, number>();

    getAllPosts().forEach(post => {
        categoryMap.set(post.category, (categoryMap.get(post.category) || 0) + 1);
    });

    return Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
}

export function getPostsByTag(tag: string): Post[] {
    return getAllPosts().filter(post => post.tags.includes(tag));
}

export function getPostsByCategory(category: string): Post[] {
    return getAllPosts().filter(post => post.category === category);
}
