/**
 * GitHub Repository Parser
 * Extracts details from GitHub repository pages
 */
import { PuppeteerCrawler } from "crawlee";
/**
 * Parse GitHub repository page
 */
export async function parseGitHubRepo(url) {
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
            log.info(`Parsing GitHub: ${url}`);
            await page.waitForSelector("body", { timeout: 15000 });
            await new Promise(resolve => setTimeout(resolve, 1000));
            const extracted = await page.evaluate(() => {
                const result = {};
                // Description (About section)
                const aboutSection = document.querySelector('[data-testid="about-section"] p, .f4.my-3');
                if (aboutSection) {
                    result.description = aboutSection.textContent?.trim();
                }
                // Topics/Tags
                const topicLinks = document.querySelectorAll('a[data-octo-click="topic_click"], .topic-tag');
                result.topics = Array.from(topicLinks)
                    .map(el => el.textContent?.trim())
                    .filter((t) => !!t)
                    .slice(0, 10);
                // License
                const licenseEl = document.querySelector('[data-analytics-event*="license"], a[href*="LICENSE"]');
                if (licenseEl) {
                    result.license = licenseEl.textContent?.trim().replace(/license/i, "").trim();
                }
                // Author/Organization
                const authorEl = document.querySelector('[rel="author"], .author a, [data-hovercard-type="user"], [data-hovercard-type="organization"]');
                if (authorEl) {
                    result.author = authorEl.textContent?.trim();
                }
                // README preview (first 500 chars)
                const readmeEl = document.querySelector('article.markdown-body, .readme .markdown-body');
                if (readmeEl) {
                    result.readme = readmeEl.textContent?.trim().slice(0, 500);
                }
                // Languages
                const langLinks = document.querySelectorAll('[data-ga-click*="language"], .repository-lang-stats-graph span');
                result.languages = Array.from(langLinks)
                    .map(el => el.textContent?.trim())
                    .filter((l) => !!l && l.length < 30)
                    .slice(0, 5);
                return result;
            });
            details.fullDescription = extracted.description;
            details.topics = extracted.topics;
            details.license = extracted.license;
            details.author = extracted.author;
            details.readmePreview = extracted.readme;
            details.technologies = extracted.languages;
        },
        failedRequestHandler({ log }) {
            log.error(`Failed to parse GitHub: ${url}`);
        },
    });
    try {
        await crawler.run([url]);
    }
    catch (error) {
        console.error(`Error parsing GitHub ${url}:`, error);
    }
    return details;
}
//# sourceMappingURL=github-parser.js.map