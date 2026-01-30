/**
 * HuggingFace Model/Space Parser
 * Extracts details from HuggingFace pages
 */

import { PuppeteerCrawler } from "crawlee";
import type { NewsItemDetails } from "../types.js";

/**
 * Parse HuggingFace model or space page
 */
export async function parseHuggingFace(url: string): Promise<NewsItemDetails> {
  const details: NewsItemDetails = {};

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
      log.info(`Parsing HuggingFace: ${url}`);

      await page.waitForSelector("body", { timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 1500));

      const extracted = await page.evaluate(() => {
        const result: {
          description?: string;
          author?: string;
          tags?: string[];
          license?: string;
          readme?: string;
          modelType?: string;
        } = {};

        // Model card / Description
        const descEl = document.querySelector('.prose, [class*="ModelCard"], article');
        if (descEl) {
          result.description = descEl.textContent?.trim().slice(0, 1000);
        }

        // Author
        const authorEl = document.querySelector('a[href^="/"][class*="author"], header a[href^="/"]');
        if (authorEl) {
          result.author = authorEl.textContent?.trim();
        }

        // Tags
        const tagEls = document.querySelectorAll('a[href*="/tags/"], [class*="tag"], .inline-flex.items-center');
        result.tags = Array.from(tagEls)
          .map(el => el.textContent?.trim())
          .filter((t): t is string => !!t && t.length < 50)
          .slice(0, 10);

        // License
        const licenseEl = document.querySelector('a[href*="license"], [class*="license"]');
        if (licenseEl) {
          result.license = licenseEl.textContent?.trim();
        }

        // README / Model card content
        const readmeEl = document.querySelector('.prose, article.markdown-body, [class*="readme"]');
        if (readmeEl) {
          result.readme = readmeEl.textContent?.trim().slice(0, 500);
        }

        // Model type (if visible)
        const typeEl = document.querySelector('[class*="pipeline"], [class*="task"]');
        if (typeEl) {
          result.modelType = typeEl.textContent?.trim();
        }

        return result;
      });

      details.fullDescription = extracted.description;
      details.author = extracted.author;
      details.topics = extracted.tags;
      details.license = extracted.license;
      details.readmePreview = extracted.readme;

      // Add model type to technologies if available
      if (extracted.modelType) {
        details.technologies = [extracted.modelType];
      }
    },

    failedRequestHandler({ log }) {
      log.error(`Failed to parse HuggingFace: ${url}`);
    },
  });

  try {
    await crawler.run([url]);
  } catch (error) {
    console.error(`Error parsing HuggingFace ${url}:`, error);
  }

  return details;
}
