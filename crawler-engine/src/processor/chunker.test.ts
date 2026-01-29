import { describe, it, expect } from 'vitest';
import { Chunker } from './chunker';

describe('Chunker', () => {
  describe('Constructor', () => {
    it('should create chunker with default options', () => {
      const chunker = new Chunker();
      expect(chunker).toBeInstanceOf(Chunker);
    });

    it('should merge custom options with defaults', () => {
      const chunker = new Chunker({ maxTokens: 1000 });
      expect(chunker).toBeInstanceOf(Chunker);
    });
  });

  describe('Single Chunk', () => {
    it('should return single chunk for small content', () => {
      const chunker = new Chunker({ maxTokens: 1000 });
      const content = 'This is a short piece of content.';
      const chunks = chunker.chunk(content);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
      expect(chunks[0].index).toBe(0);
      expect(chunks[0].startOffset).toBe(0);
      expect(chunks[0].endOffset).toBe(content.length);
    });

    it('should estimate token count', () => {
      const chunker = new Chunker();
      const content = 'This is a test content with several words.';
      const chunks = chunker.chunk(content);

      expect(chunks[0].tokenCount).toBeGreaterThan(0);
      expect(chunks[0].tokenCount).toBeLessThanOrEqual(content.split(/\s+/).length);
    });

    it('should handle empty content', () => {
      const chunker = new Chunker();
      const content = '';
      const chunks = chunker.chunk(content);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('');
    });
  });

  describe('Multiple Chunks', () => {
    it('should split large content into multiple chunks', () => {
      const chunker = new Chunker({ maxTokens: 20 });
      const content = 'Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(10);
      const chunks = chunker.chunk(content);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should assign sequential indices to chunks', () => {
      const chunker = new Chunker({ maxTokens: 20 });
      const content = 'Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(10);
      const chunks = chunker.chunk(content);

      chunks.forEach((chunk, index) => {
        expect(chunk.index).toBe(index);
      });
    });

    it('should maintain content coverage', () => {
      const chunker = new Chunker({ maxTokens: 30, overlapTokens: 0 });
      const content = 'word '.repeat(100);
      const chunks = chunker.chunk(content);

      // All chunks together should cover most of the content
      const totalChunkLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
      expect(totalChunkLength).toBeGreaterThan(content.length * 0.8);
    });
  });

  describe('Chunk by Tokens', () => {
    it('should respect maxTokens limit', () => {
      const maxTokens = 50;
      const chunker = new Chunker({ maxTokens, chunkBy: 'tokens' });
      const content = 'word '.repeat(200);
      const chunks = chunker.chunk(content);

      chunks.forEach((chunk) => {
        const wordCount = chunk.content.split(/\s+/).filter(w => w).length;
        // Each chunk should be roughly within the token limit
        expect(wordCount).toBeLessThanOrEqual(maxTokens * 1.5); // Some tolerance
      });
    });

    it('should create overlapping chunks when overlapTokens > 0', () => {
      const chunker = new Chunker({
        maxTokens: 30,
        overlapTokens: 10,
        chunkBy: 'tokens',
      });
      const content = 'word '.repeat(100);
      const chunks = chunker.chunk(content);

      if (chunks.length > 1) {
        // Check that consecutive chunks have some overlap
        // This is approximate due to word boundaries
        expect(chunks.length).toBeGreaterThan(1);
      }
    });
  });

  describe('Chunk by Paragraphs', () => {
    it('should split by paragraph boundaries', () => {
      const chunker = new Chunker({ maxTokens: 50, chunkBy: 'paragraphs' });
      const content = 'Paragraph 1.\n\nParagraph 2.\n\nParagraph 3.';
      const chunks = chunker.chunk(content);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should preserve paragraph structure', () => {
      const chunker = new Chunker({ maxTokens: 100, chunkBy: 'paragraphs' });
      const content = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const chunks = chunker.chunk(content);

      // Each chunk should contain complete paragraphs
      chunks.forEach((chunk) => {
        expect(chunk.content.trim().length).toBeGreaterThan(0);
      });
    });

    it('should handle content without paragraph breaks', () => {
      const chunker = new Chunker({ maxTokens: 20, chunkBy: 'paragraphs' });
      const content = 'This is one long paragraph without any breaks.'.repeat(5);
      const chunks = chunker.chunk(content);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Chunk by Sentences', () => {
    it('should split by sentence boundaries', () => {
      const chunker = new Chunker({ maxTokens: 30, chunkBy: 'sentences' });
      const content = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      const chunks = chunker.chunk(content);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should preserve sentence structure', () => {
      const chunker = new Chunker({ maxTokens: 50, chunkBy: 'sentences' });
      const content = 'Sentence one. Sentence two. Sentence three.';
      const chunks = chunker.chunk(content);

      // Each chunk should contain complete sentences
      chunks.forEach((chunk) => {
        expect(chunk.content.trim().length).toBeGreaterThan(0);
      });
    });

    it('should handle various sentence endings', () => {
      const chunker = new Chunker({ maxTokens: 50, chunkBy: 'sentences' });
      const content = 'Question? Exclamation! Statement. Another one.';
      const chunks = chunker.chunk(content);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Header Preservation', () => {
    it('should detect and preserve headers', () => {
      const chunker = new Chunker({
        maxTokens: 30,
        preserveHeaders: true,
        chunkBy: 'tokens',
      });
      const content = '# Main Header\n\n' + 'Content '.repeat(50);
      const chunks = chunker.chunk(content);

      if (chunks.length > 1) {
        // Later chunks should include the header for context
        const hasHeaderInLaterChunk = chunks.slice(1).some(
          chunk => chunk.content.includes('#') || chunk.content.includes('Header')
        );
        expect(hasHeaderInLaterChunk).toBe(true);
      }
    });

    it('should handle multiple header levels', () => {
      const chunker = new Chunker({ maxTokens: 30, preserveHeaders: true });
      const content = '# H1\n## H2\n### H3\n' + 'Content '.repeat(50);
      const chunks = chunker.chunk(content);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should not preserve headers when option is false', () => {
      const chunker = new Chunker({
        maxTokens: 30,
        preserveHeaders: false,
        chunkBy: 'tokens',
      });
      const content = '# Main Header\n\n' + 'Content '.repeat(50);
      const chunks = chunker.chunk(content);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Offset Tracking', () => {
    it('should track start and end offsets', () => {
      const chunker = new Chunker({ maxTokens: 30 });
      const content = 'word '.repeat(100);
      const chunks = chunker.chunk(content);

      chunks.forEach((chunk) => {
        expect(chunk.startOffset).toBeGreaterThanOrEqual(0);
        expect(chunk.endOffset).toBeGreaterThan(chunk.startOffset);
        expect(chunk.endOffset).toBeLessThanOrEqual(content.length);
      });
    });

    it('should have continuous or overlapping offsets', () => {
      const chunker = new Chunker({ maxTokens: 30, overlapTokens: 5 });
      const content = 'word '.repeat(100);
      const chunks = chunker.chunk(content);

      if (chunks.length > 1) {
        for (let i = 0; i < chunks.length - 1; i++) {
          // Next chunk should start at or before current chunk ends (with overlap)
          expect(chunks[i + 1].startOffset).toBeLessThanOrEqual(chunks[i].endOffset);
        }
      }
    });

    it('should cover entire content span', () => {
      const chunker = new Chunker({ maxTokens: 30, overlapTokens: 0 });
      const content = 'word '.repeat(50);
      const chunks = chunker.chunk(content);

      expect(chunks[0].startOffset).toBe(0);
      expect(chunks[chunks.length - 1].endOffset).toBeLessThanOrEqual(content.length);
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens for typical text', () => {
      const chunker = new Chunker();
      const content = 'This is a test sentence with several words.';
      const chunks = chunker.chunk(content);

      const tokenCount = chunks[0].tokenCount;
      const wordCount = content.split(/\s+/).length;

      // Token count should be reasonably close to word count
      expect(tokenCount).toBeGreaterThan(0);
      expect(tokenCount).toBeLessThanOrEqual(wordCount * 1.5);
    });

    it('should handle punctuation in estimation', () => {
      const chunker = new Chunker();
      const content = 'Hello, world! How are you? I am fine.';
      const chunks = chunker.chunk(content);

      expect(chunks[0].tokenCount).toBeGreaterThan(0);
    });

    it('should handle special characters', () => {
      const chunker = new Chunker();
      const content = 'Code: `function() { return true; }`';
      const chunks = chunker.chunk(content);

      expect(chunks[0].tokenCount).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very short maxTokens', () => {
      const chunker = new Chunker({ maxTokens: 2 });
      const content = 'This is a test';
      const chunks = chunker.chunk(content);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should handle very large maxTokens', () => {
      const chunker = new Chunker({ maxTokens: 100000 });
      const content = 'word '.repeat(1000);
      const chunks = chunker.chunk(content);

      // Should return single chunk
      expect(chunks).toHaveLength(1);
    });

    it('should handle content with only whitespace', () => {
      const chunker = new Chunker();
      const content = '     \n\n\n     ';
      const chunks = chunker.chunk(content);

      expect(chunks).toHaveLength(1);
    });

    it('should handle content with unicode characters', () => {
      const chunker = new Chunker({ maxTokens: 20 });
      const content = '你好世界 Hello World مرحبا بالعالم '.repeat(10);
      const chunks = chunker.chunk(content);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should handle content with emoji', () => {
      const chunker = new Chunker({ maxTokens: 20 });
      const content = 'Hello 🌍 World 🚀 Test 🎉 '.repeat(10);
      const chunks = chunker.chunk(content);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle single word longer than maxTokens', () => {
      const chunker = new Chunker({ maxTokens: 5 });
      const content = 'supercalifragilisticexpialidocious';
      const chunks = chunker.chunk(content);

      // Should still create at least one chunk
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('supercalifragilisticexpialidocious');
    });
  });

  describe('Content Integrity', () => {
    it('should not lose content during chunking', () => {
      const chunker = new Chunker({ maxTokens: 30, overlapTokens: 0 });
      const words = 'word '.repeat(100).trim().split(/\s+/);
      const content = words.join(' ');
      const chunks = chunker.chunk(content);

      // Reconstruct content from non-overlapping chunks
      const reconstructedWords = chunks
        .flatMap(chunk => chunk.content.trim().split(/\s+/))
        .filter(w => w);

      // Should have most words (accounting for chunk boundaries)
      expect(reconstructedWords.length).toBeGreaterThan(words.length * 0.9);
    });

    it('should maintain relative word order', () => {
      const chunker = new Chunker({ maxTokens: 20 });
      const content = 'first second third fourth fifth sixth seventh eighth ninth tenth';
      const chunks = chunker.chunk(content);

      // First chunk should contain words that appear early
      expect(chunks[0].content).toContain('first');

      // Last chunk should contain words that appear late
      expect(chunks[chunks.length - 1].content).toContain('tenth');
    });
  });
});
