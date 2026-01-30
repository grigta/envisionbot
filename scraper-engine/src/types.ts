// ============================================
// CRAWL CONFIGURATION
// ============================================

export interface CrawlConfig {
  /** Crawl depth (1-3 levels recommended) */
  depth: number;
  /** Maximum pages to crawl */
  maxPages: number;
  /** Parse sitemap.xml for URL discovery */
  useSitemap: boolean;
  /** Honor robots.txt rules */
  respectRobotsTxt: boolean;
  /** Multiple domains for batch processing */
  batchDomains?: string[];

  // Anti-detection settings
  /** Enable proxy rotation */
  proxyRotation: boolean;
  /** List of proxy URLs (http:// or socks5://) */
  proxyList?: string[];
  /** Enable User-Agent rotation */
  userAgentRotation: boolean;
  /** Minimum delay between requests (ms) */
  minDelay: number;
  /** Maximum delay between requests (ms) */
  maxDelay: number;
  /** Use headless browser for JS-rendered sites */
  useHeadless: boolean;
  /** Maximum concurrent requests */
  maxConcurrency?: number;
  /** Maximum requests per minute */
  maxRequestsPerMinute?: number;
}

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  depth: 2,
  maxPages: 100,
  useSitemap: true,
  respectRobotsTxt: true,
  proxyRotation: false,
  userAgentRotation: true,
  minDelay: 2000,
  maxDelay: 5000,
  useHeadless: true,
  maxConcurrency: 3,
  maxRequestsPerMinute: 20,
};

// ============================================
// CRAWLED DATA TYPES
// ============================================

export interface CrawledPage {
  id: string;
  competitorId: string;
  crawlJobId?: string;
  url: string;
  path: string;
  depth: number;
  statusCode?: number;
  contentType?: string;

  // SEO Data
  seo: SEOData;

  // Content structure
  headings: HeadingsData;
  images: ImageData[];
  links: LinkData[];

  // Content metrics
  wordCount: number;
  textContent?: string;
  htmlContent?: string;

  // Performance
  responseTimeMs?: number;
  crawledAt: number;
}

export interface SEOData {
  title?: string;
  metaDescription?: string;
  metaKeywords?: string;
  canonicalUrl?: string;
  robots?: string;

  // Open Graph
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;

  // Twitter Cards
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;

  // Structured data
  schemaTypes?: string[];
  hasStructuredData: boolean;
}

export interface HeadingsData {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
}

export interface ImageData {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  isLazyLoaded: boolean;
}

export interface LinkData {
  href: string;
  text: string;
  title?: string;
  rel?: string;
  isExternal: boolean;
  isNofollow: boolean;
}

// ============================================
// TECH STACK DETECTION
// ============================================

export type TechCategory =
  | 'cms'
  | 'framework'
  | 'javascript-framework'
  | 'css-framework'
  | 'analytics'
  | 'marketing'
  | 'advertising'
  | 'pixel'
  | 'chat'
  | 'cdn'
  | 'hosting'
  | 'ecommerce'
  | 'payment'
  | 'security'
  | 'performance'
  | 'video'
  | 'font'
  | 'database'
  | 'server'
  | 'programming-language'
  | 'other';

export interface TechStackItem {
  category: TechCategory;
  name: string;
  version?: string;
  confidence: number; // 0-100
  detectedBy: 'header' | 'script' | 'meta' | 'pattern' | 'cookie' | 'dns' | 'html';
  evidence?: string;
  icon?: string;
  website?: string;
}

export interface TechPattern {
  name: string;
  category: TechCategory;
  patterns: PatternRule[];
  version?: PatternRule;
  icon?: string;
  website?: string;
}

export interface PatternRule {
  type: 'header' | 'script' | 'meta' | 'html' | 'cookie' | 'url';
  pattern?: RegExp;
  selector?: string;
  attribute?: string;
  headerName?: string;
  cookieName?: string;
}

// ============================================
// SITE STRUCTURE
// ============================================

export interface SiteStructureNode {
  path: string;
  parentPath?: string;
  depth: number;
  pageCount: number;
  childCount: number;
  nodeType: 'page' | 'folder' | 'root';
  children?: SiteStructureNode[];
  title?: string;
  pageUrl?: string;
}

export interface SiteStructureAnalysis {
  totalPages: number;
  maxDepth: number;
  rootNode: SiteStructureNode;
  topLevelFolders: string[];
  flatStructure: boolean;
  hasProductCatalog: boolean;
  hasBlog: boolean;
  hasDocumentation: boolean;
}

// ============================================
// SEO ANALYSIS
// ============================================

export interface SEOAnalysisResult {
  score: number; // 0-100
  issues: SEOIssue[];
  opportunities: string[];
  strengths: string[];

  // Detailed metrics
  titleAnalysis: TitleAnalysis;
  descriptionAnalysis: DescriptionAnalysis;
  headingsAnalysis: HeadingsAnalysis;
  imagesAnalysis: ImagesAnalysis;
  linksAnalysis: LinksAnalysis;
  contentAnalysis: ContentAnalysis;
}

export interface SEOIssue {
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  affectedPages?: string[];
  recommendation?: string;
}

export interface TitleAnalysis {
  hasTitle: boolean;
  averageLength: number;
  tooShort: number;
  tooLong: number;
  duplicates: number;
  missing: number;
}

export interface DescriptionAnalysis {
  hasDescription: boolean;
  averageLength: number;
  tooShort: number;
  tooLong: number;
  duplicates: number;
  missing: number;
}

export interface HeadingsAnalysis {
  hasH1: boolean;
  multipleH1: number;
  missingH1: number;
  properHierarchy: boolean;
  averageH1Length: number;
}

export interface ImagesAnalysis {
  totalImages: number;
  withoutAlt: number;
  withAlt: number;
  lazyLoaded: number;
  altPercentage: number;
}

export interface LinksAnalysis {
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: number;
  nofollow: number;
}

export interface ContentAnalysis {
  averageWordCount: number;
  thinContent: number; // Pages with < 300 words
  duplicateContent: number;
  readabilityScore?: number;
}

// ============================================
// AI ANALYSIS
// ============================================

export interface PositioningAnalysis {
  summary: string;
  valueProposition: string;
  targetAudience: string[];
  keyMessages: string[];
  toneOfVoice: string;
  uniqueSellingPoints: string[];
  competitiveAdvantages: string[];
}

export interface SWOTAnalysis {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
}

export interface SWOTItem {
  title: string;
  description: string;
  evidence?: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface CompetitiveRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'seo' | 'content' | 'ux' | 'marketing' | 'technical' | 'positioning';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  actionItems: string[];
}

export interface CompetitiveRecommendations {
  recommendations: CompetitiveRecommendation[];
  quickWins: string[];
  longTermStrategies: string[];
  gaps: string[];
}

export interface FullAnalysis {
  competitorId: string;
  domain: string;
  analyzedAt: number;

  positioning: PositioningAnalysis;
  swot: SWOTAnalysis;
  recommendations: CompetitiveRecommendations;
  seo: SEOAnalysisResult;
  techStack: TechStackItem[];
  structure: SiteStructureAnalysis;

  modelUsed: string;
  tokensUsed?: number;
}

// ============================================
// CRAWL JOB & RESULTS
// ============================================

export interface CrawlJob {
  id: string;
  competitorId: string;
  status: CrawlJobStatus;
  config: CrawlConfig;
  startedAt?: number;
  completedAt?: number;
  pagesFound: number;
  pagesCrawled: number;
  errors: CrawlError[];
  durationMs?: number;
}

export type CrawlJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface CrawlError {
  url: string;
  message: string;
  code?: string;
  timestamp: number;
}

export interface CrawlResult {
  success: boolean;
  job: CrawlJob;
  pages: CrawledPage[];
  techStack: TechStackItem[];
  structure: SiteStructureAnalysis;
  errors: CrawlError[];
  summary: CrawlSummary;
}

export interface CrawlSummary {
  totalPages: number;
  successfulPages: number;
  failedPages: number;
  totalLinks: number;
  totalImages: number;
  averageResponseTime: number;
  crawlDuration: number;
}

// ============================================
// REPORTS
// ============================================

export interface CompetitorReport {
  id: string;
  competitorIds: string[];
  reportType: 'single' | 'comparison' | 'market_overview';
  title: string;
  format: 'json' | 'markdown' | 'html';
  content: string;
  summary?: string;
  createdAt: number;
  createdBy: string;
}

// ============================================
// PROGRESS CALLBACKS
// ============================================

export interface CrawlProgress {
  competitorId: string;
  jobId: string;
  status: CrawlJobStatus;
  pagesFound: number;
  pagesCrawled: number;
  currentUrl?: string;
  progress: number; // 0-100
  estimatedTimeRemaining?: number;
}

export type ProgressCallback = (progress: CrawlProgress) => void;

// ============================================
// USER AGENTS
// ============================================

export const USER_AGENTS = {
  desktop: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
  ],
  mobile: [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  ],
};
