/**
 * Reddit Post Parser
 * Extracts details from Reddit posts
 */
import { PuppeteerCrawler } from "crawlee";
/**
 * Parse Reddit post
 */
export async function parseReddit(url) {
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
            log.info(`Parsing Reddit: ${url}`);
            await page.waitForSelector("body", { timeout: 15000 });
            await new Promise(resolve => setTimeout(resolve, 2000));
            const extracted = await page.evaluate(() => {
                const result = {};
                // Post title
                const titleEl = document.querySelector('h1, [data-testid="post-title"], [slot="title"]');
                if (titleEl) {
                    result.title = titleEl.textContent?.trim();
                }
                // Post content
                const contentEl = document.querySelector('[data-testid="post-content"], [slot="text-body"], .Post .RichTextJSON-root, .usertext-body');
                if (contentEl) {
                    result.content = contentEl.textContent?.trim().slice(0, 1000);
                }
                // Author
                const authorEl = document.querySelector('a[href*="/user/"], [data-testid="post-author-link"]');
                if (authorEl) {
                    result.author = authorEl.textContent?.trim().replace(/^u\//, "");
                }
                // Subreddit
                const subredditEl = document.querySelector('a[href*="/r/"][data-testid="subreddit-name"], a[href^="/r/"]');
                if (subredditEl) {
                    result.subreddit = subredditEl.textContent?.trim().replace(/^r\//, "");
                }
                // Score (upvotes)
                const scoreEl = document.querySelector('[data-testid="post-score"], .score, [id*="score"]');
                if (scoreEl) {
                    result.score = scoreEl.textContent?.trim();
                }
                // Comments count
                const commentsEl = document.querySelector('[data-testid="comments-count"], a[href*="comments"]');
                if (commentsEl) {
                    const text = commentsEl.textContent?.trim();
                    const match = text?.match(/(\d+)/);
                    if (match)
                        result.comments = match[1];
                }
                return result;
            });
            details.fullDescription = extracted.content || extracted.title;
            details.author = extracted.author;
            // Add subreddit as topic
            if (extracted.subreddit) {
                details.topics = [extracted.subreddit];
            }
            // Use score as metric context
            if (extracted.score) {
                details.readmePreview = `Score: ${extracted.score}${extracted.comments ? `, Comments: ${extracted.comments}` : ""}`;
            }
        },
        failedRequestHandler({ log }) {
            log.error(`Failed to parse Reddit: ${url}`);
        },
    });
    try {
        await crawler.run([url]);
    }
    catch (error) {
        console.error(`Error parsing Reddit ${url}:`, error);
    }
    return details;
}
//# sourceMappingURL=reddit-parser.js.map