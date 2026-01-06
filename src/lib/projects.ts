import { marked } from 'marked';
import * as yaml from 'js-yaml';

export interface Project {
    title: string;
    description: string;
    link: string;
    tags: string[];
    status: string;
    featured: boolean;
    content: string;
    slug: string;
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { data: {}, content: raw };

    try {
        const data = yaml.load(match[1]) as Record<string, unknown>;
        return { data, content: match[2] };
    } catch {
        return { data: {}, content: raw };
    }
}

const projectModules = import.meta.glob('/content/projects/*.md', {
    query: '?raw',
    import: 'default',
    eager: true
});

// Singleton cache for parsed projects
let cachedProjects: Project[] | null = null;

export function getAllProjects(): Project[] {
    if (cachedProjects) return cachedProjects;

    const projects: Project[] = [];

    for (const path in projectModules) {
        const raw = projectModules[path] as string;
        const { data, content } = parseFrontmatter(raw);

        projects.push({
            title: (data.title as string) || 'Untitled Project',
            description: (data.description as string) || '',
            link: (data.link as string) || '#',
            tags: (data.tags as string[]) || [],
            status: (data.status as string) || 'unknown',
            featured: (data.featured as boolean) || false,
            slug: path.split('/').pop()?.replace('.md', '') || '',
            content: marked(content) as string,
        });
    }

    cachedProjects = projects;
    return cachedProjects;
}

export function getFeaturedProjects(): Project[] {
    return getAllProjects().filter(p => p.featured);
}
