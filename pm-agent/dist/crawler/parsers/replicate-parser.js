/**
 * Replicate Model Parser
 * Extracts details from Replicate model pages
 */
import { PuppeteerCrawler } from "crawlee";
/**
 * Parse Replicate model page
 */
export async function parseReplicate(url) {
    const details = {};
    const crawler = new PuppeteerCrawler({
        maxRequestsPerCrawl: 1,
        headless: true,
        launchContext: {
            launchOptions: {
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                ],
            },
        },
        async requestHandler({ page, log }) {
            log.info(`Parsing Replicate: ${url}`);
            await page.waitForSelector("body", { timeout: 15000 });
            await new Promise(resolve => setTimeout(resolve, 1500));
            const extracted = await page.evaluate(() => {
                const result = {};
                // Description
                const descEl = document.querySelector('[class*="description"], .prose, p.text-gray-600');
                if (descEl) {
                    result.description = descEl.textContent?.trim();
                }
                // Author
                const authorEl = document.querySelector('a[href^="/"][class*="author"], [class*="creator"] a');
                if (authorEl) {
                    result.author = authorEl.textContent?.trim();
                }
                // Tags/Categories
                const tagEls = document.querySelectorAll('a[href*="/collections/"], [class*="tag"], [class*="badge"]');
                result.tags = Array.from(tagEls)
                    .map(el => el.textContent?.trim())
                    .filter((t) => !!t && t.length < 50 && !t.includes("Run"))
                    .slice(0, 10);
                // README / Full description
                const readmeEl = document.querySelector('.prose, article, [class*="readme"]');
                if (readmeEl) {
                    result.readme = readmeEl.textContent?.trim().slice(0, 500);
                }
                // Run count
                const runEl = document.querySelector('[class*="runs"], [class*="count"]');
                if (runEl) {
                    result.runCount = runEl.textContent?.trim();
                }
                // Input/Output types from API schema
                const schemaEls = document.querySelectorAll('[class*="schema"], [class*="input"], [class*="output"]');
                const schemaText = Array.from(schemaEls).map(el => el.textContent).join(" ");
                if (schemaText.includes("image"))
                    result.inputTypes = [...(result.inputTypes || []), "image"];
                if (schemaText.includes("text"))
                    result.inputTypes = [...(result.inputTypes || []), "text"];
                if (schemaText.includes("audio"))
                    result.inputTypes = [...(result.inputTypes || []), "audio"];
                if (schemaText.includes("video"))
                    result.inputTypes = [...(result.inputTypes || []), "video"];
                return result;
            });
            details.fullDescription = extracted.description;
            details.author = extracted.author;
            details.topics = extracted.tags;
            details.readmePreview = extracted.readme;
            // Combine input types as technologies
            if (extracted.inputTypes && extracted.inputTypes.length > 0) {
                details.technologies = extracted.inputTypes;
            }
        },
        failedRequestHandler({ log }) {
            log.error(`Failed to parse Replicate: ${url}`);
        },
    });
    try {
        await crawler.run([url]);
    }
    catch (error) {
        console.error(`Error parsing Replicate ${url}:`, error);
    }
    return details;
}
//# sourceMappingURL=replicate-parser.js.map