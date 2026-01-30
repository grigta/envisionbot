import type { TechStackItem, TechCategory } from '../types.js';
export interface TechDetectionContext {
    headers: Record<string, string>;
    cookies: string[];
    scripts: string[];
    html: string;
    meta: Record<string, string>;
}
/**
 * Detect technologies from context
 */
export declare function detectTechStack(context: TechDetectionContext): TechStackItem[];
/**
 * Group tech stack by category
 */
export declare function groupByCategory(techStack: TechStackItem[]): Record<TechCategory, TechStackItem[]>;
/**
 * Get human-readable category name
 */
export declare function getCategoryLabel(category: TechCategory): string;
//# sourceMappingURL=tech-detector.d.ts.map