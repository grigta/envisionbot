import * as cheerio from 'cheerio';
// ============================================
// SEO DATA EXTRACTION
// ============================================
/**
 * Extract SEO data from HTML using Cheerio
 */
export function extractSEOData($) {
    return {
        // Basic meta
        title: $('title').first().text().trim() || undefined,
        metaDescription: $('meta[name="description"]').attr('content')?.trim() || undefined,
        metaKeywords: $('meta[name="keywords"]').attr('content')?.trim() || undefined,
        canonicalUrl: $('link[rel="canonical"]').attr('href')?.trim() || undefined,
        robots: $('meta[name="robots"]').attr('content')?.trim() || undefined,
        // Open Graph
        ogTitle: $('meta[property="og:title"]').attr('content')?.trim() || undefined,
        ogDescription: $('meta[property="og:description"]').attr('content')?.trim() || undefined,
        ogImage: $('meta[property="og:image"]').attr('content')?.trim() || undefined,
        ogType: $('meta[property="og:type"]').attr('content')?.trim() || undefined,
        ogUrl: $('meta[property="og:url"]').attr('content')?.trim() || undefined,
        // Twitter Cards
        twitterCard: $('meta[name="twitter:card"]').attr('content')?.trim() || undefined,
        twitterTitle: $('meta[name="twitter:title"]').attr('content')?.trim() || undefined,
        twitterDescription: $('meta[name="twitter:description"]').attr('content')?.trim() || undefined,
        twitterImage: $('meta[name="twitter:image"]').attr('content')?.trim() || undefined,
        // Structured data detection
        schemaTypes: extractSchemaTypes($),
        hasStructuredData: $('script[type="application/ld+json"]').length > 0,
    };
}
/**
 * Extract Schema.org types from structured data
 */
function extractSchemaTypes($) {
    const types = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        try {
            const json = JSON.parse($(el).html() || '{}');
            if (json['@type']) {
                if (Array.isArray(json['@type'])) {
                    types.push(...json['@type']);
                }
                else {
                    types.push(json['@type']);
                }
            }
            // Check @graph for multiple items
            if (json['@graph']) {
                for (const item of json['@graph']) {
                    if (item['@type']) {
                        types.push(item['@type']);
                    }
                }
            }
        }
        catch {
            // Invalid JSON, skip
        }
    });
    return [...new Set(types)];
}
// ============================================
// HEADINGS EXTRACTION
// ============================================
/**
 * Extract all headings from HTML
 */
export function extractHeadings($) {
    const headings = {
        h1: [],
        h2: [],
        h3: [],
        h4: [],
        h5: [],
        h6: [],
    };
    for (let i = 1; i <= 6; i++) {
        $(`h${i}`).each((_, el) => {
            const text = $(el).text().trim();
            if (text) {
                headings[`h${i}`].push(text);
            }
        });
    }
    return headings;
}
// ============================================
// IMAGES EXTRACTION
// ============================================
/**
 * Extract images from HTML
 */
export function extractImages($, baseUrl) {
    const images = [];
    $('img').each((_, el) => {
        const $img = $(el);
        const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src');
        if (src) {
            images.push({
                src: resolveUrl(src, baseUrl),
                alt: $img.attr('alt')?.trim() || undefined,
                title: $img.attr('title')?.trim() || undefined,
                width: parseInt($img.attr('width') || '0', 10) || undefined,
                height: parseInt($img.attr('height') || '0', 10) || undefined,
                isLazyLoaded: !!($img.attr('loading') === 'lazy' || $img.attr('data-src') || $img.attr('data-lazy-src')),
            });
        }
    });
    // Also check picture elements
    $('picture source').each((_, el) => {
        const srcset = $(el).attr('srcset');
        if (srcset) {
            const firstSrc = srcset.split(',')[0]?.trim().split(' ')[0];
            if (firstSrc && !images.some(img => img.src === resolveUrl(firstSrc, baseUrl))) {
                images.push({
                    src: resolveUrl(firstSrc, baseUrl),
                    isLazyLoaded: false,
                });
            }
        }
    });
    return images;
}
// ============================================
// LINKS EXTRACTION
// ============================================
/**
 * Extract links from HTML
 */
export function extractLinks($, baseUrl) {
    const links = [];
    const baseDomain = new URL(baseUrl).hostname;
    $('a[href]').each((_, el) => {
        const $a = $(el);
        const href = $a.attr('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
        }
        const resolvedUrl = resolveUrl(href, baseUrl);
        const rel = $a.attr('rel') || '';
        let isExternal = false;
        try {
            const linkDomain = new URL(resolvedUrl).hostname;
            isExternal = linkDomain !== baseDomain;
        }
        catch {
            // Invalid URL
        }
        links.push({
            href: resolvedUrl,
            text: $a.text().trim().substring(0, 200),
            title: $a.attr('title')?.trim() || undefined,
            rel: rel || undefined,
            isExternal,
            isNofollow: rel.includes('nofollow'),
        });
    });
    return links;
}
// ============================================
// CONTENT EXTRACTION
// ============================================
/**
 * Extract text content from HTML (cleaned)
 */
export function extractTextContent($) {
    // Clone to avoid modifying original
    const $clone = $.root().clone();
    // Remove non-content elements
    $clone.find('script, style, noscript, iframe, svg, header, footer, nav, aside, form').remove();
    // Get text
    let text = $clone.text();
    // Clean up whitespace
    text = text
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    return text;
}
/**
 * Count words in text
 */
export function countWords(text) {
    if (!text)
        return 0;
    return text
        .split(/\s+/)
        .filter(word => word.length > 0)
        .length;
}
/**
 * Extract all data from HTML string
 */
export function extractFromHtml(html, url) {
    const $ = cheerio.load(html);
    const textContent = extractTextContent($);
    return {
        seo: extractSEOData($),
        headings: extractHeadings($),
        images: extractImages($, url),
        links: extractLinks($, url),
        textContent,
        wordCount: countWords(textContent),
    };
}
/**
 * Extract data from Playwright page
 */
export async function extractFromPage(page, url) {
    const html = await page.content();
    return extractFromHtml(html, url);
}
/**
 * Create CrawledPage from extraction result
 */
export function createCrawledPage(id, competitorId, url, depth, extraction, crawlJobId, statusCode, responseTimeMs) {
    const urlObj = new URL(url);
    return {
        id,
        competitorId,
        crawlJobId,
        url,
        path: urlObj.pathname,
        depth,
        statusCode,
        contentType: 'text/html',
        seo: extraction.seo,
        headings: extraction.headings,
        images: extraction.images,
        links: extraction.links,
        wordCount: extraction.wordCount,
        textContent: extraction.textContent.substring(0, 50000), // Limit to 50KB
        responseTimeMs,
        crawledAt: Date.now(),
    };
}
// ============================================
// UTILITIES
// ============================================
/**
 * Resolve relative URL to absolute
 */
export function resolveUrl(href, baseUrl) {
    try {
        return new URL(href, baseUrl).href;
    }
    catch {
        return href;
    }
}
/**
 * Normalize URL for deduplication
 */
export function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);
        // Remove trailing slash
        let path = urlObj.pathname.replace(/\/+$/, '') || '/';
        // Remove default index pages
        path = path.replace(/\/(index\.(html?|php|asp|aspx|jsp))$/i, '/');
        // Lowercase hostname
        return `${urlObj.protocol}//${urlObj.hostname.toLowerCase()}${path}${urlObj.search}`;
    }
    catch {
        return url;
    }
}
/**
 * Check if URL should be crawled (filter out non-HTML resources)
 */
export function shouldCrawlUrl(url) {
    const skipExtensions = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.zip', '.rar', '.tar', '.gz', '.7z',
        '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico',
        '.css', '.js', '.json', '.xml', '.rss', '.atom',
        '.woff', '.woff2', '.ttf', '.eot', '.otf',
    ];
    const lowerUrl = url.toLowerCase();
    return !skipExtensions.some(ext => lowerUrl.endsWith(ext));
}
/**
 * Extract domain from URL
 */
export function extractDomain(url) {
    try {
        return new URL(url).hostname;
    }
    catch {
        return url;
    }
}
/**
 * Get path depth
 */
export function getPathDepth(path) {
    return path.split('/').filter(p => p.length > 0).length;
}
//# sourceMappingURL=page-extractor.js.map