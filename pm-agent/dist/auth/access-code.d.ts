/**
 * Access code utilities for authentication
 */
/**
 * Validate access code format: XXXX-XXXX-XXXX (alphanumeric)
 */
export declare function validateAccessCodeFormat(code: string): boolean;
/**
 * Normalize access code: uppercase, ensure dashes
 * Returns empty string if code is invalid length
 */
export declare function normalizeAccessCode(code: string): string;
/**
 * Hash an access code using bcrypt
 */
export declare function hashAccessCode(code: string): Promise<string>;
/**
 * Compare a plain access code with a bcrypt hash
 */
export declare function compareAccessCode(code: string, hash: string): Promise<boolean>;
/**
 * Generate a random access code in XXXX-XXXX-XXXX format
 */
export declare function generateAccessCode(): string;
//# sourceMappingURL=access-code.d.ts.map