import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signToken, verifyToken, decodeToken } from './jwt';
import type { JWTPayload } from './jwt';

describe('JWT Utilities', () => {
  const mockPayload = {
    sub: 'test-access-code-id',
    name: 'Test User',
    role: 'user',
  };

  beforeEach(() => {
    // Reset environment for consistent testing
    vi.unstubAllEnvs();
  });

  describe('signToken', () => {
    it('should sign a valid JWT token', () => {
      const token = signToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include all required payload fields', () => {
      const token = signToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.sub).toBe(mockPayload.sub);
      expect(decoded?.name).toBe(mockPayload.name);
      expect(decoded?.role).toBe(mockPayload.role);
      expect(decoded?.jti).toBeDefined();
      expect(decoded?.iat).toBeDefined();
      expect(decoded?.exp).toBeDefined();
    });

    it('should generate unique jti for each token', () => {
      const token1 = signToken(mockPayload);
      const token2 = signToken(mockPayload);

      const decoded1 = decodeToken(token1);
      const decoded2 = decodeToken(token2);

      expect(decoded1?.jti).not.toBe(decoded2?.jti);
    });

    it('should set expiration time', () => {
      const token = signToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded?.exp).toBeDefined();
      expect(decoded?.exp).toBeGreaterThan(decoded!.iat);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', () => {
      const token = signToken(mockPayload);
      const verified = verifyToken(token);

      expect(verified).toBeDefined();
      expect(verified.sub).toBe(mockPayload.sub);
      expect(verified.name).toBe(mockPayload.name);
      expect(verified.role).toBe(mockPayload.role);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow();
    });

    it('should throw error for malformed token', () => {
      const malformedToken = 'not-a-jwt-token';

      expect(() => verifyToken(malformedToken)).toThrow();
    });

    it('should verify token with different roles', () => {
      const adminPayload = { ...mockPayload, role: 'admin' };
      const readonlyPayload = { ...mockPayload, role: 'readonly' };

      const adminToken = signToken(adminPayload);
      const readonlyToken = signToken(readonlyPayload);

      const verifiedAdmin = verifyToken(adminToken);
      const verifiedReadonly = verifyToken(readonlyToken);

      expect(verifiedAdmin.role).toBe('admin');
      expect(verifiedReadonly.role).toBe('readonly');
    });
  });

  describe('decodeToken', () => {
    it('should decode a valid token without verification', () => {
      const token = signToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded?.sub).toBe(mockPayload.sub);
      expect(decoded?.name).toBe(mockPayload.name);
      expect(decoded?.role).toBe(mockPayload.role);
    });

    it('should return null for invalid token', () => {
      const invalidToken = 'not-a-valid-token';
      const decoded = decodeToken(invalidToken);

      expect(decoded).toBeNull();
    });

    it('should decode token even if signature is invalid', () => {
      const token = signToken(mockPayload);
      // Tamper with the token by changing last character
      const tamperedToken = token.slice(0, -1) + 'X';

      // decodeToken doesn't verify signature, so it should still decode
      const decoded = decodeToken(tamperedToken);

      expect(decoded).toBeDefined();
      // But verifyToken should fail
      expect(() => verifyToken(tamperedToken)).toThrow();
    });

    it('should decode and show all JWT fields', () => {
      const token = signToken(mockPayload);
      const decoded = decodeToken(token);

      expect(decoded).toHaveProperty('sub');
      expect(decoded).toHaveProperty('name');
      expect(decoded).toHaveProperty('role');
      expect(decoded).toHaveProperty('jti');
      expect(decoded).toHaveProperty('iat');
      expect(decoded).toHaveProperty('exp');
    });
  });

  describe('Token lifecycle', () => {
    it('should create, verify, and decode token successfully', () => {
      // Sign
      const token = signToken(mockPayload);
      expect(token).toBeDefined();

      // Verify
      const verified = verifyToken(token);
      expect(verified.sub).toBe(mockPayload.sub);

      // Decode
      const decoded = decodeToken(token);
      expect(decoded?.sub).toBe(mockPayload.sub);

      // Verify and decode should return same payload
      expect(verified.sub).toBe(decoded?.sub);
      expect(verified.name).toBe(decoded?.name);
      expect(verified.role).toBe(decoded?.role);
      expect(verified.jti).toBe(decoded?.jti);
    });

    it('should handle multiple users with different payloads', () => {
      const user1 = signToken({ sub: 'user-1', name: 'Alice', role: 'admin' });
      const user2 = signToken({ sub: 'user-2', name: 'Bob', role: 'user' });
      const user3 = signToken({ sub: 'user-3', name: 'Charlie', role: 'readonly' });

      const verified1 = verifyToken(user1);
      const verified2 = verifyToken(user2);
      const verified3 = verifyToken(user3);

      expect(verified1.name).toBe('Alice');
      expect(verified1.role).toBe('admin');
      expect(verified2.name).toBe('Bob');
      expect(verified2.role).toBe('user');
      expect(verified3.name).toBe('Charlie');
      expect(verified3.role).toBe('readonly');
    });
  });
});
