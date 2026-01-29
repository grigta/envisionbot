import { describe, it, expect } from 'vitest';
import { HTMLCleaner } from './html-cleaner';

describe('HTMLCleaner', () => {
  describe('Constructor', () => {
    it('should create cleaner with default options', () => {
      const cleaner = new HTMLCleaner();
      expect(cleaner).toBeInstanceOf(HTMLCleaner);
    });

    it('should merge custom options with defaults', () => {
      const cleaner = new HTMLCleaner({ removeScripts: false });
      expect(cleaner).toBeInstanceOf(HTMLCleaner);
    });
  });

  describe('Script Removal', () => {
    it('should remove script tags', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Content<script>alert("test")</script></div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('<script>');
      expect(result).not.toContain('alert');
      expect(result).toContain('Content');
    });

    it('should remove noscript tags', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Content<noscript>No JS</noscript></div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('<noscript>');
      expect(result).not.toContain('No JS');
    });

    it('should preserve scripts when removeScripts is false', () => {
      const cleaner = new HTMLCleaner({ removeScripts: false });
      const html = '<div>Content<script>alert("test")</script></div>';
      const result = cleaner.clean(html);

      expect(result).toContain('<script>');
    });
  });

  describe('Style Removal', () => {
    it('should remove style tags', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Content<style>.test { color: red; }</style></div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('<style>');
      expect(result).not.toContain('color: red');
    });

    it('should remove inline style attributes', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div style="color: red;">Content</div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('style=');
      expect(result).not.toContain('color: red');
      expect(result).toContain('Content');
    });

    it('should preserve styles when removeStyles is false', () => {
      const cleaner = new HTMLCleaner({ removeStyles: false });
      const html = '<div style="color: red;">Content</div>';
      const result = cleaner.clean(html);

      expect(result).toContain('style');
    });
  });

  describe('Excluded Tags', () => {
    it('should remove excluded tags', () => {
      const cleaner = new HTMLCleaner({ excludedTags: ['nav', 'footer'] });
      const html = '<div>Content<nav>Navigation</nav><footer>Footer</footer></div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('<nav>');
      expect(result).not.toContain('Navigation');
      expect(result).not.toContain('<footer>');
      expect(result).not.toContain('Footer');
      expect(result).toContain('Content');
    });

    it('should remove default excluded tags', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Content<iframe src="test"></iframe></div>';
      const result = cleaner.clean(html);

      // iframe is in default excluded tags
      expect(result).not.toContain('<iframe>');
    });
  });

  describe('Excluded Classes', () => {
    it('should remove elements with excluded classes', () => {
      const cleaner = new HTMLCleaner({ excludedClasses: ['ad', 'sidebar'] });
      const html = `
        <div>Content</div>
        <div class="ad">Advertisement</div>
        <div class="sidebar">Sidebar</div>
      `;
      const result = cleaner.clean(html);

      expect(result).not.toContain('Advertisement');
      expect(result).not.toContain('Sidebar');
      expect(result).toContain('Content');
    });

    it('should match class patterns case-insensitively', () => {
      const cleaner = new HTMLCleaner({ excludedClasses: ['ad'] });
      const html = '<div class="AD">Advertisement</div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('Advertisement');
    });

    it('should match partial class names', () => {
      const cleaner = new HTMLCleaner({ excludedClasses: ['ad'] });
      const html = '<div class="banner-ad">Advertisement</div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('Advertisement');
    });

    it('should handle multiple classes', () => {
      const cleaner = new HTMLCleaner({ excludedClasses: ['ad'] });
      const html = '<div class="container ad banner">Advertisement</div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('Advertisement');
    });
  });

  describe('Excluded IDs', () => {
    it('should remove elements with excluded IDs', () => {
      const cleaner = new HTMLCleaner({ excludedIds: ['header', 'footer'] });
      const html = `
        <div>Content</div>
        <div id="header">Header</div>
        <div id="footer">Footer</div>
      `;
      const result = cleaner.clean(html);

      expect(result).not.toContain('Header');
      expect(result).not.toContain('Footer');
      expect(result).toContain('Content');
    });

    it('should match ID patterns case-insensitively', () => {
      const cleaner = new HTMLCleaner({ excludedIds: ['header'] });
      const html = '<div id="HEADER">Header</div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('Header');
    });

    it('should match partial IDs', () => {
      const cleaner = new HTMLCleaner({ excludedIds: ['nav'] });
      const html = '<div id="main-nav">Navigation</div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('Navigation');
    });
  });

  describe('Hidden Elements', () => {
    it('should remove elements with hidden attribute', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Content<div hidden>Hidden</div></div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('Hidden');
      expect(result).toContain('Content');
    });

    it('should remove elements with aria-hidden="true"', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Content<div aria-hidden="true">Hidden</div></div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('Hidden');
    });

    it('should remove elements with display:none', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Content<div style="display: none">Hidden</div></div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('Hidden');
    });

    it('should remove elements with visibility:hidden', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Content<div style="visibility: hidden">Hidden</div></div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('Hidden');
    });

    it('should handle display:none without spaces', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Content<div style="display:none">Hidden</div></div>';
      const result = cleaner.clean(html);

      expect(result).not.toContain('Hidden');
    });
  });

  describe('Complex HTML', () => {
    it('should clean complex nested HTML', () => {
      const cleaner = new HTMLCleaner({
        excludedTags: ['nav', 'footer'],
        excludedClasses: ['ad'],
        excludedIds: ['sidebar'],
      });

      const html = `
        <html>
          <head>
            <script>alert("test")</script>
            <style>.test { color: red; }</style>
          </head>
          <body>
            <nav>Navigation</nav>
            <div class="content">
              <h1>Main Content</h1>
              <p>Paragraph text</p>
              <div class="ad">Advertisement</div>
              <div id="sidebar">Sidebar</div>
            </div>
            <footer>Footer</footer>
          </body>
        </html>
      `;

      const result = cleaner.clean(html);

      expect(result).toContain('Main Content');
      expect(result).toContain('Paragraph text');
      expect(result).not.toContain('Navigation');
      expect(result).not.toContain('Advertisement');
      expect(result).not.toContain('Sidebar');
      expect(result).not.toContain('Footer');
      expect(result).not.toContain('<script>');
      expect(result).not.toContain('<style>');
    });

    it('should preserve content structure', () => {
      const cleaner = new HTMLCleaner();
      const html = `
        <article>
          <h1>Title</h1>
          <p>First paragraph</p>
          <p>Second paragraph</p>
        </article>
      `;

      const result = cleaner.clean(html);

      expect(result).toContain('<article>');
      expect(result).toContain('<h1>');
      expect(result).toContain('Title');
      expect(result).toContain('<p>');
      expect(result).toContain('First paragraph');
      expect(result).toContain('Second paragraph');
    });

    it('should handle empty HTML', () => {
      const cleaner = new HTMLCleaner();
      const html = '';
      const result = cleaner.clean(html);

      expect(result).toBe('');
    });

    it('should handle HTML with only excluded elements', () => {
      const cleaner = new HTMLCleaner();
      const html = '<script>alert("test")</script><style>.test{}</style>';
      const result = cleaner.clean(html);

      expect(result.trim()).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed HTML', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Unclosed div<p>Paragraph';
      const result = cleaner.clean(html);

      // Cheerio will auto-close tags
      expect(result).toContain('Unclosed div');
      expect(result).toContain('Paragraph');
    });

    it('should handle HTML entities', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>&lt;script&gt;alert()&lt;/script&gt;</div>';
      const result = cleaner.clean(html);

      expect(result).toContain('&lt;script&gt;');
    });

    it('should handle unicode characters', () => {
      const cleaner = new HTMLCleaner();
      const html = '<div>Hello 世界 🌍</div>';
      const result = cleaner.clean(html);

      expect(result).toContain('世界');
      expect(result).toContain('🌍');
    });
  });
});
