import type { CrawledPage, SiteStructureNode, SiteStructureAnalysis } from '../types.js';

// ============================================
// STRUCTURE ANALYSIS
// ============================================

/**
 * Analyze site structure from crawled pages
 */
export function analyzeSiteStructure(pages: CrawledPage[]): SiteStructureAnalysis {
  const pathCounts = new Map<string, number>();
  const pathTitles = new Map<string, string>();
  const pathUrls = new Map<string, string>();
  let maxDepth = 0;

  // Count pages per path
  for (const page of pages) {
    const path = normalizePath(page.path);
    pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
    if (page.seo.title) {
      pathTitles.set(path, page.seo.title);
    }
    pathUrls.set(path, page.url);

    // Track max depth
    const depth = getPathDepth(path);
    maxDepth = Math.max(maxDepth, depth);
  }

  // Build folder hierarchy
  const folders = buildFolderHierarchy(pathCounts);

  // Build tree structure
  const rootNode = buildTree(folders, pathCounts, pathTitles, pathUrls);

  // Get top-level folders
  const topLevelFolders = [...folders]
    .filter(([path]) => getPathDepth(path) === 1)
    .sort((a, b) => b[1] - a[1])
    .map(([path]) => path);

  // Detect common patterns
  const patterns = detectPatterns(topLevelFolders, pathCounts);

  return {
    totalPages: pages.length,
    maxDepth,
    rootNode,
    topLevelFolders,
    flatStructure: maxDepth <= 2,
    hasProductCatalog: patterns.hasProductCatalog,
    hasBlog: patterns.hasBlog,
    hasDocumentation: patterns.hasDocumentation,
  };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize path for consistency
 */
function normalizePath(path: string): string {
  // Remove trailing slash except for root
  let normalized = path.replace(/\/+$/, '') || '/';
  // Remove query string
  normalized = normalized.split('?')[0];
  // Remove index.html etc.
  normalized = normalized.replace(/\/(index\.(html?|php|asp|aspx|jsp))$/i, '/');
  return normalized;
}

/**
 * Get depth of path
 */
function getPathDepth(path: string): number {
  if (path === '/') return 0;
  return path.split('/').filter((p) => p.length > 0).length;
}

/**
 * Build folder hierarchy from paths
 */
function buildFolderHierarchy(pathCounts: Map<string, number>): Map<string, number> {
  const folders = new Map<string, number>();

  for (const [path, count] of pathCounts) {
    // Add this path's count to all parent folders
    const parts = path.split('/').filter((p) => p.length > 0);

    for (let i = 0; i < parts.length; i++) {
      const folderPath = '/' + parts.slice(0, i + 1).join('/');
      folders.set(folderPath, (folders.get(folderPath) || 0) + count);
    }
  }

  return folders;
}

/**
 * Build tree structure
 */
function buildTree(
  folders: Map<string, number>,
  pathCounts: Map<string, number>,
  pathTitles: Map<string, string>,
  pathUrls: Map<string, string>
): SiteStructureNode {
  // Root node
  const rootCount = pathCounts.get('/') || 0;
  const rootNode: SiteStructureNode = {
    path: '/',
    depth: 0,
    pageCount: rootCount,
    childCount: 0,
    nodeType: 'root',
    title: pathTitles.get('/'),
    pageUrl: pathUrls.get('/'),
    children: [],
  };

  // Group paths by parent
  const pathsByParent = new Map<string, string[]>();

  for (const path of folders.keys()) {
    if (path === '/') continue;

    const parentPath = getParentPath(path);
    if (!pathsByParent.has(parentPath)) {
      pathsByParent.set(parentPath, []);
    }
    pathsByParent.get(parentPath)!.push(path);
  }

  // Build children recursively
  function addChildren(node: SiteStructureNode): void {
    const childPaths = pathsByParent.get(node.path) || [];

    for (const childPath of childPaths) {
      const depth = getPathDepth(childPath);
      const pageCount = pathCounts.get(childPath) || 0;
      const folderCount = folders.get(childPath) || 0;

      const childNode: SiteStructureNode = {
        path: childPath,
        parentPath: node.path,
        depth,
        pageCount,
        childCount: 0,
        nodeType: pageCount > 0 ? 'page' : 'folder',
        title: pathTitles.get(childPath),
        pageUrl: pathUrls.get(childPath),
        children: [],
      };

      // Recursively add children
      addChildren(childNode);
      childNode.childCount = childNode.children?.length || 0;

      // Update to folder if has children
      if (childNode.childCount > 0) {
        childNode.nodeType = 'folder';
        childNode.pageCount = folderCount;
      }

      node.children!.push(childNode);
    }

    // Sort children by page count descending
    node.children?.sort((a, b) => b.pageCount - a.pageCount);
  }

  addChildren(rootNode);
  rootNode.childCount = rootNode.children?.length || 0;

  return rootNode;
}

/**
 * Get parent path
 */
function getParentPath(path: string): string {
  if (path === '/') return '/';
  const parts = path.split('/').filter((p) => p.length > 0);
  if (parts.length <= 1) return '/';
  return '/' + parts.slice(0, -1).join('/');
}

/**
 * Detect common site patterns
 */
function detectPatterns(
  topLevelFolders: string[],
  pathCounts: Map<string, number>
): {
  hasProductCatalog: boolean;
  hasBlog: boolean;
  hasDocumentation: boolean;
} {
  const allPaths = [...pathCounts.keys()].join(' ');

  return {
    hasProductCatalog: /\/(products?|catalog|shop|store|items?|goods)\//i.test(allPaths) ||
      topLevelFolders.some((f) => /^\/(products?|catalog|shop|store)/i.test(f)),

    hasBlog: /\/(blog|news|articles?|posts?|journal|magazine)\//i.test(allPaths) ||
      topLevelFolders.some((f) => /^\/(blog|news|articles?)/i.test(f)),

    hasDocumentation: /\/(docs?|documentation|help|guide|wiki|faq|support)\//i.test(allPaths) ||
      topLevelFolders.some((f) => /^\/(docs?|documentation|help)/i.test(f)),
  };
}

// ============================================
// EXPORT UTILITIES
// ============================================

/**
 * Flatten tree structure to array
 */
export function flattenTree(node: SiteStructureNode): SiteStructureNode[] {
  const result: SiteStructureNode[] = [node];

  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenTree(child));
    }
  }

  return result;
}

/**
 * Get paths at specific depth
 */
export function getPathsAtDepth(node: SiteStructureNode, depth: number): SiteStructureNode[] {
  return flattenTree(node).filter((n) => n.depth === depth);
}

/**
 * Find node by path
 */
export function findNodeByPath(root: SiteStructureNode, path: string): SiteStructureNode | null {
  if (root.path === path) return root;

  if (root.children) {
    for (const child of root.children) {
      const found = findNodeByPath(child, path);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Get structure statistics
 */
export function getStructureStats(analysis: SiteStructureAnalysis): {
  avgDepth: number;
  avgPagesPerFolder: number;
  largestSection: string;
  deepestPath: string;
} {
  const allNodes = flattenTree(analysis.rootNode);
  const folders = allNodes.filter((n) => n.nodeType === 'folder' || n.nodeType === 'root');

  const depths = allNodes.map((n) => n.depth);
  const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;

  const avgPagesPerFolder = folders.reduce((sum, f) => sum + f.pageCount, 0) / folders.length;

  const largestSection = analysis.topLevelFolders[0] || '/';

  const deepestNode = allNodes.reduce((max, node) => (node.depth > max.depth ? node : max), allNodes[0]);

  return {
    avgDepth: Math.round(avgDepth * 10) / 10,
    avgPagesPerFolder: Math.round(avgPagesPerFolder * 10) / 10,
    largestSection,
    deepestPath: deepestNode?.path || '/',
  };
}

/**
 * Generate structure summary text
 */
export function generateStructureSummary(analysis: SiteStructureAnalysis): string {
  const parts: string[] = [];

  parts.push(`Total ${analysis.totalPages} pages with max depth of ${analysis.maxDepth} levels.`);

  if (analysis.flatStructure) {
    parts.push('The site has a flat structure, which is good for SEO.');
  } else {
    parts.push('The site has a deep hierarchical structure.');
  }

  if (analysis.topLevelFolders.length > 0) {
    parts.push(`Main sections: ${analysis.topLevelFolders.slice(0, 5).join(', ')}.`);
  }

  const features: string[] = [];
  if (analysis.hasBlog) features.push('blog/news section');
  if (analysis.hasProductCatalog) features.push('product catalog');
  if (analysis.hasDocumentation) features.push('documentation');

  if (features.length > 0) {
    parts.push(`Detected: ${features.join(', ')}.`);
  }

  return parts.join(' ');
}
