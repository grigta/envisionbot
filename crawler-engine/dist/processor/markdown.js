/**
 * Markdown Converter - Converts HTML to Markdown for LLM processing
 * Uses Turndown library with custom rules
 */
import TurndownService from 'turndown';
import { DEFAULT_MARKDOWN_OPTIONS } from '../types.js';
export class MarkdownConverter {
    turndown;
    options;
    constructor(options = {}) {
        this.options = { ...DEFAULT_MARKDOWN_OPTIONS, ...options };
        this.turndown = new TurndownService({
            headingStyle: this.options.headingStyle,
            codeBlockStyle: this.options.codeBlockStyle,
            bulletListMarker: this.options.bulletListMarker,
            emDelimiter: '_',
            strongDelimiter: '**',
            linkStyle: 'inlined',
        });
        this.setupDefaultRules();
        this.setupCustomRules();
    }
    setupDefaultRules() {
        // Remove empty links
        this.turndown.addRule('removeEmptyLinks', {
            filter: (node) => {
                return (node.nodeName === 'A' &&
                    !node.textContent?.trim() &&
                    !node.querySelector('img'));
            },
            replacement: () => '',
        });
        // Clean up images (optional)
        if (!this.options.keepImages) {
            this.turndown.addRule('removeImages', {
                filter: 'img',
                replacement: () => '',
            });
        }
        else {
            // Simplify images
            this.turndown.addRule('simplifyImages', {
                filter: 'img',
                replacement: (_, node) => {
                    const el = node;
                    const alt = el.getAttribute('alt') || '';
                    const src = el.getAttribute('src') || '';
                    if (!src)
                        return '';
                    // Skip base64 images
                    if (src.startsWith('data:'))
                        return alt ? `[Image: ${alt}]` : '';
                    return alt ? `![${alt}](${src})` : `![](${src})`;
                },
            });
        }
        // Handle links
        if (!this.options.keepLinks) {
            this.turndown.addRule('removeLinks', {
                filter: 'a',
                replacement: (content) => content,
            });
        }
        // Handle tables (simplified) - just keep the content as is for now
        // Tables are complex to convert properly, so we just return the text content
        this.turndown.addRule('simplifyTables', {
            filter: ['table'],
            replacement: (content) => {
                // Return the content with some basic cleanup
                const cleanContent = content
                    .split('\n')
                    .map((line) => line.trim())
                    .filter((line) => line.length > 0)
                    .join('\n');
                return cleanContent ? '\n\n' + cleanContent + '\n\n' : '';
            },
        });
        // Remove SVG
        this.turndown.addRule('removeSvg', {
            filter: 'svg',
            replacement: () => '',
        });
        // Remove iframes
        this.turndown.addRule('removeIframe', {
            filter: 'iframe',
            replacement: () => '',
        });
        // Clean up multiple newlines
        this.turndown.addRule('cleanNewlines', {
            filter: (node) => {
                return node.nodeName === 'BR';
            },
            replacement: () => '\n',
        });
        // Handle divs that might contain useful content
        this.turndown.addRule('handleDivs', {
            filter: (node) => {
                return (node.nodeName === 'DIV' &&
                    node.textContent?.trim().length === 0 &&
                    !node.querySelector('img'));
            },
            replacement: () => '',
        });
    }
    setupCustomRules() {
        if (this.options.customRules) {
            for (const rule of this.options.customRules) {
                this.turndown.addRule(rule.name, {
                    filter: rule.filter,
                    replacement: rule.replacement,
                });
            }
        }
    }
    /**
     * Convert HTML to Markdown
     */
    convert(html) {
        let markdown = this.turndown.turndown(html);
        // Post-processing cleanup
        markdown = this.postProcess(markdown);
        return markdown;
    }
    postProcess(markdown) {
        // Remove excessive blank lines (more than 2)
        markdown = markdown.replace(/\n{3,}/g, '\n\n');
        // Remove leading/trailing whitespace on lines
        markdown = markdown
            .split('\n')
            .map((line) => line.trimEnd())
            .join('\n');
        // Remove excessive spaces
        markdown = markdown.replace(/ {2,}/g, ' ');
        // Clean up list formatting
        markdown = markdown.replace(/^(\s*[-*+])\s+/gm, '$1 ');
        // Remove empty links like [](url)
        markdown = markdown.replace(/\[\]\([^)]*\)/g, '');
        // Remove markdown links with empty text
        markdown = markdown.replace(/\[\s*\]\([^)]+\)/g, '');
        // Trim the final result
        markdown = markdown.trim();
        return markdown;
    }
    /**
     * Add a custom conversion rule
     */
    addRule(rule) {
        this.turndown.addRule(rule.name, {
            filter: rule.filter,
            replacement: rule.replacement,
        });
    }
}
export function createMarkdownConverter(options) {
    return new MarkdownConverter(options);
}
//# sourceMappingURL=markdown.js.map