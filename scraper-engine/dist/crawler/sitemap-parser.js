import * as cheerio from 'cheerio';
/**
 * Parse sitemap XML content
 */
export function parseSitemap(content) {
    const result = {
        urls: [],
        sitemapIndexes: [],
        errors: [],
    };
    try {
        const $ = cheerio.load(content, { xmlMode: true });
        // Check if it's a sitemap index
        const sitemapLocs = $('sitemapindex > sitemap > loc');
        if (sitemapLocs.length > 0) {
            sitemapLocs.each((_, el) => {
                const loc = $(el).text().trim();
                if (loc) {
                    result.sitemapIndexes.push(loc);
                }
            });
            return result;
        }
        // Parse regular sitemap
        $('urlset > url').each((_, el) => {
            const $url = $(el);
            const loc = $url.find('loc').text().trim();
            if (loc) {
                result.urls.push({
                    loc,
                    lastmod: $url.find('lastmod').text().trim() || undefined,
                    changefreq: $url.find('changefreq').text().trim() || undefined,
                    priority: parseFloat($url.find('priority').text()) || undefined,
                });
            }
        });
    }
    catch (error) {
        result.errors.push(`Failed to parse sitemap: ${error instanceof Error ? error.message : String(error)}`);
    }
    return result;
}
/**
 * Fetch and parse sitemap from URL
 */
export async function fetchSitemap(baseUrl, maxUrls = 1000, timeout = 30000) {
    const result = {
        urls: [],
        sitemapIndexes: [],
        errors: [],
    };
    const sitemapUrls = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/sitemap-index.xml`,
        `${baseUrl}/sitemaps.xml`,
    ];
    // Try common sitemap locations
    for (const sitemapUrl of sitemapUrls) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(sitemapUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; CompetitorBot/1.0)',
                    'Accept': 'application/xml, text/xml, */*',
                },
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                continue;
            }
            const content = await response.text();
            const parsed = parseSitemap(content);
            // Add errors
            result.errors.push(...parsed.errors);
            // If we found a sitemap index, fetch child sitemaps
            if (parsed.sitemapIndexes.length > 0) {
                for (const indexUrl of parsed.sitemapIndexes) {
                    if (result.urls.length >= maxUrls)
                        break;
                    try {
                        const childResult = await fetchSitemapContent(indexUrl, timeout);
                        result.urls.push(...childResult.urls.slice(0, maxUrls - result.urls.length));
                        result.errors.push(...childResult.errors);
                    }
                    catch (error) {
                        result.errors.push(`Failed to fetch child sitemap ${indexUrl}: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
                return result;
            }
            // Regular sitemap
            result.urls.push(...parsed.urls.slice(0, maxUrls));
            return result;
        }
        catch (error) {
            // Continue to next sitemap URL
            if (error instanceof Error && error.name !== 'AbortError') {
                result.errors.push(`Failed to fetch ${sitemapUrl}: ${error.message}`);
            }
        }
    }
    return result;
}
/**
 * Fetch single sitemap content
 */
async function fetchSitemapContent(url, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CompetitorBot/1.0)',
                'Accept': 'application/xml, text/xml, */*',
            },
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            return {
                urls: [],
                sitemapIndexes: [],
                errors: [`HTTP ${response.status} for ${url}`],
            };
        }
        const content = await response.text();
        return parseSitemap(content);
    }
    catch (error) {
        clearTimeout(timeoutId);
        return {
            urls: [],
            sitemapIndexes: [],
            errors: [`Failed to fetch ${url}: ${error instanceof Error ? error.message : String(error)}`],
        };
    }
}
/**
 * Filter sitemap URLs by patterns
 */
export function filterSitemapUrls(urls, options = {}) {
    return urls.filter((url) => {
        // Check include patterns
        if (options.includePaths?.length) {
            const matches = options.includePaths.some((pattern) => pattern.test(url.loc));
            if (!matches)
                return false;
        }
        // Check exclude patterns
        if (options.excludePaths?.length) {
            const excluded = options.excludePaths.some((pattern) => pattern.test(url.loc));
            if (excluded)
                return false;
        }
        // Check age
        if (options.maxAge && url.lastmod) {
            const lastModDate = new Date(url.lastmod);
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() - options.maxAge);
            if (lastModDate < maxDate)
                return false;
        }
        return true;
    });
}
/**
 * Sort sitemap URLs by priority
 */
export function sortByPriority(urls) {
    return [...urls].sort((a, b) => {
        // Higher priority first
        const priorityA = a.priority ?? 0.5;
        const priorityB = b.priority ?? 0.5;
        return priorityB - priorityA;
    });
}
//# sourceMappingURL=sitemap-parser.js.map