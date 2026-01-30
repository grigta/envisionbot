/**
 * @envisionbot/crawler-engine
 * Type definitions for AI-powered universal web crawler
 */
// ============================================================================
// Default Options
// ============================================================================
export const DEFAULT_CLEANER_OPTIONS = {
    excludedTags: [
        'nav', 'footer', 'aside', 'header', 'script', 'style', 'noscript',
        'iframe', 'form', 'button', 'input', 'select', 'textarea',
    ],
    excludedClasses: [
        'nav', 'navigation', 'menu', 'sidebar', 'footer', 'header',
        'advertisement', 'ad', 'ads', 'banner', 'cookie', 'popup',
        'modal', 'overlay', 'social', 'share', 'comment', 'comments',
    ],
    excludedIds: [
        'nav', 'navigation', 'menu', 'sidebar', 'footer', 'header',
        'ad', 'ads', 'advertisement', 'banner', 'cookie', 'popup',
    ],
    removeScripts: true,
    removeStyles: true,
    removeComments: true,
    removeEmpty: true,
    keepMainContentOnly: false,
};
export const DEFAULT_MARKDOWN_OPTIONS = {
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    keepImages: true,
    keepLinks: true,
};
export const DEFAULT_PRUNING_OPTIONS = {
    enabled: false, // Disabled by default - LLM handles content filtering better
    minTextDensity: 0.1, // More permissive for link-heavy sites
    minWordCount: 3, // Allow short titles/links
    maxLinkDensity: 1.0, // Allow 100% links - important for list pages
    removePatterns: [
        /^(copyright|©|\(c\))/i,
        /^all rights reserved/i,
        /^privacy policy/i,
        /^terms (of|and) (service|use)/i,
        /^cookie policy/i,
    ],
    keepKeywords: [],
};
export const DEFAULT_CHUNK_OPTIONS = {
    maxTokens: 4000,
    overlapTokens: 200,
    chunkBy: 'tokens',
    preserveHeaders: true,
};
//# sourceMappingURL=types.js.map