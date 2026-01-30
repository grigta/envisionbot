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
export declare const DEFAULT_CRAWL_CONFIG: CrawlConfig;
export interface CrawledPage {
    id: string;
    competitorId: string;
    crawlJobId?: string;
    url: string;
    path: string;
    depth: number;
    statusCode?: number;
    contentType?: string;
    seo: SEOData;
    headings: HeadingsData;
    images: ImageData[];
    links: LinkData[];
    wordCount: number;
    textContent?: string;
    htmlContent?: string;
    responseTimeMs?: number;
    crawledAt: number;
}
export interface SEOData {
    title?: string;
    metaDescription?: string;
    metaKeywords?: string;
    canonicalUrl?: string;
    robots?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    ogType?: string;
    ogUrl?: string;
    twitterCard?: string;
    twitterTitle?: string;
    twitterDescription?: string;
    twitterImage?: string;
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
export type TechCategory = 'cms' | 'framework' | 'javascript-framework' | 'css-framework' | 'analytics' | 'marketing' | 'advertising' | 'pixel' | 'chat' | 'cdn' | 'hosting' | 'ecommerce' | 'payment' | 'security' | 'performance' | 'video' | 'font' | 'database' | 'server' | 'programming-language' | 'other';
export interface TechStackItem {
    category: TechCategory;
    name: string;
    version?: string;
    confidence: number;
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
export interface SEOAnalysisResult {
    score: number;
    issues: SEOIssue[];
    opportunities: string[];
    strengths: string[];
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
    thinContent: number;
    duplicateContent: number;
    readabilityScore?: number;
}
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
export interface CrawlProgress {
    competitorId: string;
    jobId: string;
    status: CrawlJobStatus;
    pagesFound: number;
    pagesCrawled: number;
    currentUrl?: string;
    progress: number;
    estimatedTimeRemaining?: number;
}
export type ProgressCallback = (progress: CrawlProgress) => void;
export declare const USER_AGENTS: {
    desktop: string[];
    mobile: string[];
};
//# sourceMappingURL=types.d.ts.map