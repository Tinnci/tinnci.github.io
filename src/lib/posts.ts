import { parseFrontmatter, renderMarkdown } from './markdown';

export interface PostMeta {
    title: string;
    date: string;
    slug: string;
    featured: boolean;
    color: string;
    excerpt: string;
    category: string;
    tags: string[];
    series?: string;
    seriesOrder?: number;
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
            series: data.series ? String(data.series) : undefined,
            seriesOrder: typeof data.seriesOrder === 'number' ? data.seriesOrder : undefined,
            content: renderMarkdown(content),
        });
    }

    // Sort by date descending and cache the result
    cachedPosts = posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return cachedPosts;
}

export function getPostBySlug(slug: string): Post | undefined {
    return getAllPosts().find(post => post.slug === slug);
}

export function getSeriesPosts(series: string): Post[] {
    return getAllPosts()
        .filter(post => post.series === series)
        .sort((a, b) => (a.seriesOrder ?? 999) - (b.seriesOrder ?? 999));
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
