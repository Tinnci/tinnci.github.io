import matter from 'gray-matter';
import { marked } from 'marked';

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
            category: data.category || 'Uncategorized',
            tags: data.tags || [],
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
