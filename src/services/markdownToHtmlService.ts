import MarkdownIt from 'markdown-it';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

type MarkdownToHtmlOptions = {
    breaks?: boolean;
    linkify?: boolean;
    typographer?: boolean;
    debugDir?: string;
};

export const isMarkdownToHtmlDebugEnabled = (envValue = process.env.MARKDOWN_TO_HTML): boolean => {
    const normalized = String(envValue ?? '').trim().toLowerCase();
    return normalized !== 'false' && normalized !== 'off';
};

export class MarkdownToHtmlService {
    private readonly renderer: MarkdownIt;
    private readonly debugDir: string;

    constructor(options: MarkdownToHtmlOptions = {}) {
        this.debugDir = options.debugDir ?? path.resolve(process.cwd(), 'md2html-vfcms-debug');
        this.ensureDebugDirExists();

        this.renderer = new MarkdownIt({
            html: false,
            breaks: options.breaks ?? true,
            linkify: options.linkify ?? true,
            typographer: options.typographer ?? true,
        });

        const baseValidateLink = this.renderer.validateLink.bind(this.renderer);
        this.renderer.validateLink = (url: string) => {
            if (!baseValidateLink(url)) return false;

            if (url.startsWith('#')) return true;
            if (url.startsWith('/')) return true;
            if (url.startsWith('./') || url.startsWith('../')) return true;

            try {
                const parsed = new URL(url);
                return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:' || parsed.protocol === 'tel:';
            } catch {
                return false;
            }
        };
    }

    toHtml(markdown: string): string {
        const md = markdown ?? '';
        const html = this.renderer.render(md);

        if (isMarkdownToHtmlDebugEnabled()) {
            this.writeDebugFiles(md, html);
        }

        return html;
    }

    private ensureDebugDirExists() {
        try {
            if (!fs.existsSync(this.debugDir)) {
                fs.mkdirSync(this.debugDir, { recursive: true });
            }
        } catch (error) {
            console.warn('[md2html-debug] failed to ensure debug directory exists', error);
        }
    }

    private writeDebugFiles(markdown: string, html: string) {
        try {
            this.ensureDebugDirExists();

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const baseName = `${timestamp}-${randomUUID()}`;
            const basePath = path.join(this.debugDir, baseName);

            fs.writeFileSync(`${basePath}.md`, markdown, 'utf8');
            fs.writeFileSync(`${basePath}.html`, html, 'utf8');

            console.log(`[md2html-debug] wrote ${basePath}.md and ${basePath}.html`);
        } catch (error) {
            console.warn('[md2html-debug] failed to write debug files', error);
        }
    }
}

export const markdownToHtmlService = new MarkdownToHtmlService();
