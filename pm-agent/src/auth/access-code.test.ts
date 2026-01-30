import { describe, it, expect } from 'vitest';
import {
  validateAccessCodeFormat,
  normalizeAccessCode,
  hashAccessCode,
  compareAccessCode,
  generateAccessCode,
} from './access-code';

describe('Access Code Utilities', () => {
  describe('validateAccessCodeFormat', () => {
    it('should validate correct format XXXX-XXXX-XXXX', () => {
      expect(validateAccessCodeFormat('ABCD-EFGH-2345')).toBe(true);
      expect(validateAccessCodeFormat('abcd-efgh-2345')).toBe(true);
      expect(validateAccessCodeFormat('A2B3-C4D5-E6F7')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validateAccessCodeFormat('ABCDEFGH2345')).toBe(false); // No dashes
      expect(validateAccessCodeFormat('ABC-DEFG-H234')).toBe(false); // Wrong segment lengths
      expect(validateAccessCodeFormat('ABCD-EFGH')).toBe(false); // Too short
      expect(validateAccessCodeFormat('ABCD-EFGH-2345-6789')).toBe(false); // Too long
      expect(validateAccessCodeFormat('ABCD_EFGH_2345')).toBe(false); // Wrong separator
    });

    it('should reject codes with invalid characters', () => {
      expect(validateAccessCodeFormat('ABCD-EFGH-23!5')).toBe(false);
      expect(validateAccessCodeFormat('ABCD-EFGH-23@5')).toBe(false);
      expect(validateAccessCodeFormat('ABCD EFGH 2345')).toBe(false);
    });

    it('should handle empty and null input', () => {
      expect(validateAccessCodeFormat('')).toBe(false);
    });
  });

  describe('normalizeAccessCode', () => {
    it('should normalize code to uppercase with dashes', () => {
      expect(normalizeAccessCode('abcd-efgh-2345')).toBe('ABCD-EFGH-2345');
      expect(normalizeAccessCode('AbCd-EfGh-2345')).toBe('ABCD-EFGH-2345');
    });

    it('should add dashes if missing', () => {
      expect(normalizeAccessCode('ABCDEFGH2345')).toBe('ABCD-EFGH-2345');
      expect(normalizeAccessCode('abcdefgh2345')).toBe('ABCD-EFGH-2345');
    });

    it('should remove extra spaces and special characters', () => {
      expect(normalizeAccessCode('ABCD EFGH 2345')).toBe('ABCD-EFGH-2345');
      expect(normalizeAccessCode('ABCD_EFGH_2345')).toBe('ABCD-EFGH-2345');
      expect(normalizeAccessCode('ABCD/EFGH/2345')).toBe('ABCD-EFGH-2345');
    });

    it('should return empty string for invalid length', () => {
      expect(normalizeAccessCode('ABC')).toBe('');
      expect(normalizeAccessCode('ABCDEFGH234567890')).toBe('');
      expect(normalizeAccessCode('')).toBe('');
    });

    it('should handle various dash positions', () => {
      expect(normalizeAccessCode('AB-CD-EF-GH-23-45')).toBe('ABCD-EFGH-2345');
      expect(normalizeAccessCode('A-B-C-D-E-F-G-H-2-3-4-5')).toBe('ABCD-EFGH-2345');
    });
  });

  describe('generateAccessCode', () => {
    it('should generate code in correct format', () => {
      const code = generateAccessCode();
      expect(validateAccessCodeFormat(code)).toBe(true);
    });

    it('should generate code with correct length', () => {
      const code = generateAccessCode();
      expect(code).toHaveLength(14); // 12 chars + 2 dashes
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateAccessCode());
      }
      // All 100 codes should be unique
      expect(codes.size).toBe(100);
    });

    it('should only use allowed characters', () => {
      // Excluding confusing chars: 0, O, 1, I, L
      const allowedChars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

      for (let i = 0; i < 50; i++) {
        const code = generateAccessCode().replace(/-/g, '');
        for (const char of code) {
          expect(allowedChars).toContain(char);
        }
      }
    });

    it('should not contain confusing characters', () => {
      const confusingChars = ['0', 'O', '1', 'I', 'L'];

      for (let i = 0; i < 50; i++) {
        const code = generateAccessCode();
        for (const char of confusingChars) {
          expect(code).not.toContain(char);
        }
      }
    });
  });

  describe('hashAccessCode', () => {
    it('should hash a valid access code', async () => {
      const code = 'ABCD-EFGH-2345';
      const hash = await hashAccessCode(code);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(code);
      expect(hash.startsWith('$2b$')).toBe(true); // bcrypt hash format
    });

    it('should normalize code before hashing', async () => {
      const hash1 = await hashAccessCode('ABCD-EFGH-2345');
      const hash2 = await hashAccessCode('abcd-efgh-2345');
      const hash3 = await hashAccessCode('abcdefgh2345');

      // Same code in different formats should hash to verifiable matches
      expect(await compareAccessCode('ABCD-EFGH-2345', hash1)).toBe(true);
      expect(await compareAccessCode('ABCD-EFGH-2345', hash2)).toBe(true);
      expect(await compareAccessCode('ABCD-EFGH-2345', hash3)).toBe(true);
    });

    it('should throw error for invalid code format', async () => {
      await expect(hashAccessCode('INVALID')).rejects.toThrow('Invalid access code format');
      await expect(hashAccessCode('ABC')).rejects.toThrow('Invalid access code format');
      await expect(hashAccessCode('')).rejects.toThrow('Invalid access code format');
    });

    it('should produce different hashes for same code', async () => {
      const code = 'ABCD-EFGH-2345';
      const hash1 = await hashAccessCode(code);
      const hash2 = await hashAccessCode(code);

      // bcrypt uses salt, so hashes should be different
      expect(hash1).not.toBe(hash2);
      // But both should verify correctly
      expect(await compareAccessCode(code, hash1)).toBe(true);
      expect(await compareAccessCode(code, hash2)).toBe(true);
    });
  });

  describe('compareAccessCode', () => {
    it('should verify correct code against hash', async () => {
      const code = 'ABCD-EFGH-2345';
      const hash = await hashAccessCode(code);

      expect(await compareAccessCode(code, hash)).toBe(true);
    });

    it('should reject incorrect code', async () => {
      const code = 'ABCD-EFGH-2345';
      const wrongCode = 'WXYZ-MNPQ-6789';
      const hash = await hashAccessCode(code);

      expect(await compareAccessCode(wrongCode, hash)).toBe(false);
    });

    it('should handle different code formats', async () => {
      const code = 'ABCD-EFGH-2345';
      const hash = await hashAccessCode(code);

      // All these formats should match
      expect(await compareAccessCode('ABCD-EFGH-2345', hash)).toBe(true);
      expect(await compareAccessCode('abcd-efgh-2345', hash)).toBe(true);
      expect(await compareAccessCode('abcdefgh2345', hash)).toBe(true);
      expect(await compareAccessCode('ABCD EFGH 2345', hash)).toBe(true);
    });

    it('should return false for invalid code format', async () => {
      const code = 'ABCD-EFGH-2345';
      const hash = await hashAccessCode(code);

      expect(await compareAccessCode('INVALID', hash)).toBe(false);
      expect(await compareAccessCode('', hash)).toBe(false);
      expect(await compareAccessCode('ABC', hash)).toBe(false);
    });

    it('should handle case sensitivity correctly', async () => {
      const code = 'ABCD-EFGH-2345';
      const hash = await hashAccessCode(code);

      // All case variations should match
      expect(await compareAccessCode('ABCD-EFGH-2345', hash)).toBe(true);
      expect(await compareAccessCode('abcd-efgh-2345', hash)).toBe(true);
      expect(await compareAccessCode('AbCd-EfGh-2345', hash)).toBe(true);
    });
  });

  describe('Integration tests', () => {
    it('should complete full lifecycle: generate, normalize, hash, verify', async () => {
      // Generate
      const code = generateAccessCode();
      expect(validateAccessCodeFormat(code)).toBe(true);

      // Normalize
      const normalized = normalizeAccessCode(code);
      expect(normalized).toBe(code); // Already normalized from generation

      // Hash
      const hash = await hashAccessCode(normalized);
      expect(hash).toBeDefined();

      // Verify
      expect(await compareAccessCode(code, hash)).toBe(true);
      expect(await compareAccessCode(normalized, hash)).toBe(true);
    });

    it('should handle multiple codes independently', async () => {
      const code1 = generateAccessCode();
      const code2 = generateAccessCode();

      expect(code1).not.toBe(code2);

      const hash1 = await hashAccessCode(code1);
      const hash2 = await hashAccessCode(code2);

      // Each code should only verify against its own hash
      expect(await compareAccessCode(code1, hash1)).toBe(true);
      expect(await compareAccessCode(code2, hash2)).toBe(true);
      expect(await compareAccessCode(code1, hash2)).toBe(false);
      expect(await compareAccessCode(code2, hash1)).toBe(false);
    });
  });
});
