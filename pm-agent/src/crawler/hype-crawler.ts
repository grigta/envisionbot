/**
 * Hype.replicate.dev Crawler
 * Crawls top-25 AI/ML news items using Puppeteer
 */

import { PuppeteerCrawler, Dataset } from "crawlee";
import type { HypeNewsItem, NewsSource } from "./types.js";

const HYPE_URL = "https://hype.replicate.dev/";

/**
 * Detect source type from URL or emoji
 */
function detectSource(url: string, emoji?: string): NewsSource {
  if (emoji === "⭐" || url.includes("github.com")) return "GitHub";
  if (emoji === "🤗" || url.includes("huggingface.co")) return "HuggingFace";
  if (emoji === "®️" || url.includes("replicate.com")) return "Replicate";
  if (emoji === "👽" || url.includes("reddit.com")) return "Reddit";

  // Fallback detection by URL
  if (url.includes("github")) return "GitHub";
  if (url.includes("huggingface") || url.includes("hf.co")) return "HuggingFace";
  if (url.includes("replicate")) return "Replicate";
  if (url.includes("reddit")) return "Reddit";

  return "GitHub"; // Default
}

/**
 * Validate if the item data is valid (not garbage/navigation text)
 */
function isValidItem(item: {
  title: string;
  description: string;
  url: string;
  metric: string;
}): boolean {
  // Invalid titles - navigation elements, questions, etc.
  const invalidTitlePatterns = [
    /^what is this\??$/i,
    /^past day$/i,
    /^past week$/i,
    /^past three days$/i,
    /^trending$/i,
    /^today$/i,
    /^this week$/i,
  ];

  // Invalid descriptions - navigation elements
  const invalidDescriptionPatterns = [
    /past day.*past.*week/i,
    /^past day$/i,
    /^past week$/i,
  ];

  // Check title
  const titleLower = item.title.toLowerCase().trim();
  for (const pattern of invalidTitlePatterns) {
    if (pattern.test(titleLower)) {
      console.log(`Skipping invalid item (bad title): ${item.title}`);
      return false;
    }
  }

  // Check description
  if (item.description) {
    for (const pattern of invalidDescriptionPatterns) {
      if (pattern.test(item.description)) {
        console.log(`Skipping invalid item (bad description): ${item.title}`);
        return false;
      }
    }
  }

  // Title too short (less than 3 chars) or too generic
  if (item.title.length < 3) {
    console.log(`Skipping invalid item (title too short): ${item.title}`);
    return false;
  }

  // Must have a valid metric value (some engagement)
  if (!item.metric || item.metric.trim() === "") {
    console.log(`Skipping invalid item (no metric): ${item.title}`);
    return false;
  }

  return true;
}

/**
 * Parse metric string to number
 */
function parseMetricValue(metric: string): number {
  const cleaned = metric.replace(/[^\d.kKmM]/g, "").trim();
  const num = parseFloat(cleaned);

  if (isNaN(num)) return 0;

  if (cleaned.toLowerCase().includes("k")) {
    return Math.round(num * 1000);
  }
  if (cleaned.toLowerCase().includes("m")) {
    return Math.round(num * 1000000);
  }

  return Math.round(num);
}

/**
 * Generate unique ID from URL
 */
function generateId(url: string): string {
  // Create a simple hash from URL
  const hash = url
    .replace(/https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 50);
  return hash;
}

/**
 * Crawl hype.replicate.dev and return top-25 items
 */
export async function crawlHypeList(limit: number = 25): Promise<HypeNewsItem[]> {
  const items: HypeNewsItem[] = [];

  const crawler = new PuppeteerCrawler({
    maxRequestsPerCrawl: 1,
    headless: true,

    launchContext: {
      launchOptions: {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      },
    },

    async requestHandler({ page, log }) {
      log.info(`Crawling ${HYPE_URL}`);

      // Wait for content to load
      await page.waitForSelector("body", { timeout: 30000 });

      // Give the page time to render dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract items from the page
      const extractedItems = await page.evaluate((maxItems: number) => {
        const results: Array<{
          rank: number;
          title: string;
          url: string;
          emoji: string;
          metric: string;
          description: string;
        }> = [];

        // Find all list items (li elements)
        const listItems = document.querySelectorAll("li");

        for (let i = 0; i < listItems.length && results.length < maxItems; i++) {
          const li = listItems[i];
          const link = li.querySelector("a[href]") as HTMLAnchorElement | null;

          if (!link) continue;

          const href = link.href;
          const text = link.textContent?.trim() || "";

          // Check if this is a project link
          const isProjectLink =
            href.includes("github.com") ||
            href.includes("huggingface.co") ||
            href.includes("replicate.com") ||
            href.includes("reddit.com");

          if (!isProjectLink || text.length < 3) continue;

          const liText = li.textContent || "";

          // Detect emoji
          let emoji = "";
          if (liText.includes("⭐")) emoji = "⭐";
          else if (liText.includes("🤗")) emoji = "🤗";
          else if (liText.includes("®️")) emoji = "®️";
          else if (liText.includes("👽")) emoji = "👽";

          // Extract metric (number with emoji)
          const metricMatch = liText.match(/(⭐|🤗|®️|👽)\s*(\d+[\d,.]*[kKmM]?)/);
          const metricMatch2 = liText.match(/(\d+[\d,.]*[kKmM]?)\s*(⭐|🤗|®️|👽)/);
          const metric = metricMatch
            ? `${metricMatch[1]} ${metricMatch[2]}`
            : metricMatch2
              ? `${metricMatch2[2]} ${metricMatch2[1]}`
              : "";

          // Get description - text after the link
          const linkEndIndex = liText.indexOf(text) + text.length;
          let description = liText.slice(linkEndIndex).trim();
          // Remove metric from description
          description = description.replace(/[⭐🤗®️👽]\s*\d+[\d,.]*[kKmM]?/g, "").trim();
          description = description.replace(/\d+[\d,.]*[kKmM]?\s*[⭐🤗®️👽]/g, "").trim();
          description = description.slice(0, 300);

          results.push({
            rank: results.length + 1,
            title: text,
            url: href,
            emoji,
            metric,
            description,
          });
        }

        return results;
      }, limit);

      log.info(`Extracted ${extractedItems.length} items`);

      for (const item of extractedItems) {
        // Validate item before adding
        if (!isValidItem(item)) {
          continue;
        }

        items.push({
          rank: item.rank,
          title: item.title,
          url: item.url,
          source: detectSource(item.url, item.emoji),
          metric: item.metric,
          metricValue: parseMetricValue(item.metric),
          description: item.description || undefined,
        });
      }
    },

    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed`);
    },
  });

  await crawler.run([HYPE_URL]);

  // Sort by rank and ensure we have proper rankings
  items.sort((a, b) => a.rank - b.rank);

  // Re-assign ranks if needed
  items.forEach((item, index) => {
    item.rank = index + 1;
  });

  return items.slice(0, limit);
}

/**
 * Test the crawler
 */
export async function testHypeCrawler(): Promise<void> {
  console.log("Testing Hype crawler...");
  const items = await crawlHypeList(5);
  console.log("Results:", JSON.stringify(items, null, 2));
}
