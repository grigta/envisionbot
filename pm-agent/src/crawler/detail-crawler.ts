/**
 * Detail Crawler
 * Fetches detailed information from source pages
 */

import type { HypeNewsItem, NewsItem, NewsItemDetails } from "./types.js";
import { parseSourceDetails } from "./parsers/index.js";

/**
 * Generate unique ID from URL
 */
export function generateId(url: string): string {
  const hash = url
    .replace(/https?:\/\//, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .slice(0, 50);
  return hash;
}

/**
 * Crawl details for a single news item
 */
export async function crawlItemDetails(item: HypeNewsItem): Promise<NewsItemDetails> {
  console.log(`Fetching details for: ${item.title} (${item.source})`);

  try {
    const details = await parseSourceDetails(item.url, item.source);
    return details;
  } catch (error) {
    console.error(`Error fetching details for ${item.url}:`, error);
    return {};
  }
}

/**
 * Convert HypeNewsItem to full NewsItem with details
 */
export async function convertToNewsItem(
  item: HypeNewsItem,
  fetchDetails: boolean = false
): Promise<NewsItem> {
  const now = Date.now();

  const newsItem: NewsItem = {
    ...item,
    id: generateId(item.url),
    crawledAt: now,
    updatedAt: now,
    isActive: true,
  };

  if (fetchDetails) {
    newsItem.details = await crawlItemDetails(item);
  }

  return newsItem;
}

/**
 * Batch convert items with optional details
 */
export async function convertItemsBatch(
  items: HypeNewsItem[],
  fetchDetails: boolean = false,
  onProgress?: (current: number, total: number) => void
): Promise<NewsItem[]> {
  const results: NewsItem[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (onProgress) {
      onProgress(i + 1, items.length);
    }

    const newsItem = await convertToNewsItem(item, fetchDetails);
    results.push(newsItem);

    // Small delay between requests to be polite
    if (fetchDetails && i < items.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return results;
}
