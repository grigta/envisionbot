/**
 * HTML Cleaner - Removes unwanted elements from HTML
 * Inspired by Crawl4AI's content cleaning approach
 */

import * as cheerio from 'cheerio';
import type { CleanerOptions } from '../types.js';
import { DEFAULT_CLEANER_OPTIONS } from '../types.js';

export class HTMLCleaner {
  private options: CleanerOptions;

  constructor(options: Partial<CleanerOptions> = {}) {
    this.options = { ...DEFAULT_CLEANER_OPTIONS, ...options };
  }

  /**
   * Clean HTML by removing unwanted elements
   */
  clean(html: string): string {
    const $ = cheerio.load(html);

    // Remove scripts
    if (this.options.removeScripts) {
      $('script').remove();
      $('noscript').remove();
    }

    // Remove styles
    if (this.options.removeStyles) {
      $('style').remove();
      $('[style]').removeAttr('style');
    }

    // Remove comments
    if (this.options.removeComments) {
      this.removeComments($);
    }

    // Remove excluded tags
    for (const tag of this.options.excludedTags) {
      $(tag).remove();
    }

    // Remove elements by class patterns
    for (const className of this.options.excludedClasses) {
      // Match class exactly or as part of class list
      $(`[class*="${className}"]`).each((_, el) => {
        const classes = $(el).attr('class') || '';
        const classArray = classes.toLowerCase().split(/\s+/);
        if (
          classArray.some(
            (c) =>
              c === className.toLowerCase() ||
              c.includes(className.toLowerCase())
          )
        ) {
          $(el).remove();
        }
      });
    }

    // Remove elements by ID patterns
    for (const id of this.options.excludedIds) {
      $(`#${id}`).remove();
      $(`[id*="${id}"]`).each((_, el) => {
        const elemId = $(el).attr('id') || '';
        if (elemId.toLowerCase().includes(id.toLowerCase())) {
          $(el).remove();
        }
      });
    }

    // Remove hidden elements
    $('[hidden]').remove();
    $('[aria-hidden="true"]').remove();
    $('[style*="display: none"]').remove();
    $('[style*="display:none"]').remove();
    $('[style*="visibility: hidden"]').remove();
    $('[style*="visibility:hidden"]').remove();

    // Remove common ad/tracking elements
    this.removeAdElements($);

    // Keep only main content if specified
    if (this.options.keepMainContentOnly) {
      this.keepMainContentOnly($);
    }

    // Remove empty elements
    if (this.options.removeEmpty) {
      this.removeEmptyElements($);
    }

    // Clean attributes
    this.cleanAttributes($);

    return $.html();
  }

  /**
   * Extract only the body content (without html/head)
   */
  cleanBody(html: string): string {
    const $ = cheerio.load(html);
    const cleaned = this.clean(html);
    const $cleaned = cheerio.load(cleaned);
    return $cleaned('body').html() || cleaned;
  }

  private removeComments($: cheerio.CheerioAPI): void {
    $('*')
      .contents()
      .filter(function () {
        return this.type === 'comment';
      })
      .remove();
  }

  private removeAdElements($: cheerio.CheerioAPI): void {
    // Common ad/tracking selectors
    const adSelectors = [
      '[class*="advert"]',
      '[class*="sponsor"]',
      '[class*="promo"]',
      '[class*="banner"]',
      '[class*="tracking"]',
      '[class*="analytics"]',
      '[id*="google_ads"]',
      '[id*="doubleclick"]',
      'ins.adsbygoogle',
      '[data-ad]',
      '[data-advertisement]',
    ];

    for (const selector of adSelectors) {
      try {
        $(selector).remove();
      } catch {
        // Ignore invalid selectors
      }
    }
  }

  private keepMainContentOnly($: cheerio.CheerioAPI): void {
    // Priority order for main content containers
    const mainSelectors = [
      'main',
      'article',
      '[role="main"]',
      '#main-content',
      '#main',
      '.main-content',
      '.main',
      '#content',
      '.content',
      '#article',
      '.article',
      '.post-content',
      '.entry-content',
    ];

    for (const selector of mainSelectors) {
      const main = $(selector).first();
      if (main.length && main.text().trim().length > 100) {
        const content = main.html();
        $('body').empty().html(content || '');
        return;
      }
    }

    // If no main content found, keep body as is
  }

  private removeEmptyElements($: cheerio.CheerioAPI): void {
    // Tags that should not be removed even if empty
    const keepEmpty = ['img', 'br', 'hr', 'input', 'area', 'base', 'col', 'embed', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

    let removed = true;
    let iterations = 0;
    const maxIterations = 10;

    // Iterate until no more empty elements are found
    while (removed && iterations < maxIterations) {
      removed = false;
      iterations++;

      $('*').each((_, el) => {
        const $el = $(el);
        const tagName = ('tagName' in el ? (el as { tagName: string }).tagName : '').toLowerCase();

        if (keepEmpty.includes(tagName)) {
          return;
        }

        const html = $el.html()?.trim() || '';
        const text = $el.text().trim();

        // Remove if completely empty or only whitespace
        if (!html && !text) {
          $el.remove();
          removed = true;
        }
      });
    }
  }

  private cleanAttributes($: cheerio.CheerioAPI): void {
    // Remove tracking/analytics attributes
    const removeAttrs = [
      'onclick',
      'onload',
      'onerror',
      'onmouseover',
      'onmouseout',
      'onfocus',
      'onblur',
      'data-tracking',
      'data-analytics',
      'data-ga',
      'data-gtm',
    ];

    $('*').each((_, el) => {
      const $el = $(el);
      for (const attr of removeAttrs) {
        $el.removeAttr(attr);
      }
    });
  }
}

export function createHTMLCleaner(options?: Partial<CleanerOptions>): HTMLCleaner {
  return new HTMLCleaner(options);
}
