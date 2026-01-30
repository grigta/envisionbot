import type {
  CrawledPage,
  SEOAnalysisResult,
  SEOIssue,
  TitleAnalysis,
  DescriptionAnalysis,
  HeadingsAnalysis,
  ImagesAnalysis,
  LinksAnalysis,
  ContentAnalysis,
} from '../types.js';

// ============================================
// SEO SCORING WEIGHTS
// ============================================

const WEIGHTS = {
  title: 15,
  description: 15,
  headings: 15,
  images: 10,
  links: 10,
  content: 15,
  technical: 20,
};

// ============================================
// MAIN ANALYZER
// ============================================

/**
 * Analyze SEO across all crawled pages
 */
export function analyzeSEO(pages: CrawledPage[]): SEOAnalysisResult {
  const issues: SEOIssue[] = [];
  const opportunities: string[] = [];
  const strengths: string[] = [];

  // Analyze each aspect
  const titleAnalysis = analyzeTitles(pages, issues);
  const descriptionAnalysis = analyzeDescriptions(pages, issues);
  const headingsAnalysis = analyzeHeadings(pages, issues);
  const imagesAnalysis = analyzeImages(pages, issues);
  const linksAnalysis = analyzeLinks(pages, issues);
  const contentAnalysis = analyzeContent(pages, issues);

  // Calculate scores
  const titleScore = calculateTitleScore(titleAnalysis);
  const descriptionScore = calculateDescriptionScore(descriptionAnalysis);
  const headingsScore = calculateHeadingsScore(headingsAnalysis);
  const imagesScore = calculateImagesScore(imagesAnalysis);
  const linksScore = calculateLinksScore(linksAnalysis);
  const contentScore = calculateContentScore(contentAnalysis);

  // Technical checks
  const technicalScore = analyzeTechnical(pages, issues);

  // Calculate overall score
  const score = Math.round(
    (titleScore * WEIGHTS.title +
      descriptionScore * WEIGHTS.description +
      headingsScore * WEIGHTS.headings +
      imagesScore * WEIGHTS.images +
      linksScore * WEIGHTS.links +
      contentScore * WEIGHTS.content +
      technicalScore * WEIGHTS.technical) /
      Object.values(WEIGHTS).reduce((a, b) => a + b, 0)
  );

  // Generate opportunities and strengths
  generateInsights(
    pages,
    titleAnalysis,
    descriptionAnalysis,
    headingsAnalysis,
    imagesAnalysis,
    linksAnalysis,
    contentAnalysis,
    opportunities,
    strengths
  );

  return {
    score,
    issues,
    opportunities,
    strengths,
    titleAnalysis,
    descriptionAnalysis,
    headingsAnalysis,
    imagesAnalysis,
    linksAnalysis,
    contentAnalysis,
  };
}

// ============================================
// TITLE ANALYSIS
// ============================================

function analyzeTitles(pages: CrawledPage[], issues: SEOIssue[]): TitleAnalysis {
  const titles = pages.map((p) => p.seo.title).filter(Boolean) as string[];
  const lengths = titles.map((t) => t.length);

  const analysis: TitleAnalysis = {
    hasTitle: titles.length > 0,
    averageLength: lengths.length > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
    tooShort: titles.filter((t) => t.length < 30).length,
    tooLong: titles.filter((t) => t.length > 60).length,
    duplicates: titles.length - new Set(titles).size,
    missing: pages.length - titles.length,
  };

  // Generate issues
  if (analysis.missing > 0) {
    issues.push({
      type: 'error',
      category: 'Title',
      message: `${analysis.missing} page(s) missing title tag`,
      affectedPages: pages.filter((p) => !p.seo.title).map((p) => p.url),
      recommendation: 'Add unique, descriptive title tags to all pages',
    });
  }

  if (analysis.duplicates > 0) {
    issues.push({
      type: 'warning',
      category: 'Title',
      message: `${analysis.duplicates} duplicate title(s) found`,
      recommendation: 'Create unique titles for each page',
    });
  }

  if (analysis.tooShort > 0) {
    issues.push({
      type: 'warning',
      category: 'Title',
      message: `${analysis.tooShort} title(s) are too short (< 30 chars)`,
      recommendation: 'Expand titles to 50-60 characters for better SEO',
    });
  }

  if (analysis.tooLong > 0) {
    issues.push({
      type: 'warning',
      category: 'Title',
      message: `${analysis.tooLong} title(s) are too long (> 60 chars)`,
      recommendation: 'Shorten titles to prevent truncation in search results',
    });
  }

  return analysis;
}

function calculateTitleScore(analysis: TitleAnalysis): number {
  let score = 100;
  const total = analysis.missing + (analysis.hasTitle ? 1 : 0);
  if (total === 0) return 0;

  score -= (analysis.missing / total) * 40;
  score -= (analysis.duplicates / total) * 20;
  score -= (analysis.tooShort / total) * 15;
  score -= (analysis.tooLong / total) * 10;

  return Math.max(0, Math.min(100, score));
}

// ============================================
// DESCRIPTION ANALYSIS
// ============================================

function analyzeDescriptions(pages: CrawledPage[], issues: SEOIssue[]): DescriptionAnalysis {
  const descriptions = pages.map((p) => p.seo.metaDescription).filter(Boolean) as string[];
  const lengths = descriptions.map((d) => d.length);

  const analysis: DescriptionAnalysis = {
    hasDescription: descriptions.length > 0,
    averageLength: lengths.length > 0 ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : 0,
    tooShort: descriptions.filter((d) => d.length < 70).length,
    tooLong: descriptions.filter((d) => d.length > 160).length,
    duplicates: descriptions.length - new Set(descriptions).size,
    missing: pages.length - descriptions.length,
  };

  if (analysis.missing > 0) {
    issues.push({
      type: 'error',
      category: 'Meta Description',
      message: `${analysis.missing} page(s) missing meta description`,
      affectedPages: pages.filter((p) => !p.seo.metaDescription).map((p) => p.url),
      recommendation: 'Add compelling meta descriptions to improve CTR',
    });
  }

  if (analysis.duplicates > 0) {
    issues.push({
      type: 'warning',
      category: 'Meta Description',
      message: `${analysis.duplicates} duplicate description(s) found`,
      recommendation: 'Create unique descriptions for each page',
    });
  }

  return analysis;
}

function calculateDescriptionScore(analysis: DescriptionAnalysis): number {
  let score = 100;
  const total = analysis.missing + (analysis.hasDescription ? 1 : 0);
  if (total === 0) return 0;

  score -= (analysis.missing / total) * 40;
  score -= (analysis.duplicates / total) * 20;
  score -= (analysis.tooShort / total) * 15;
  score -= (analysis.tooLong / total) * 10;

  return Math.max(0, Math.min(100, score));
}

// ============================================
// HEADINGS ANALYSIS
// ============================================

function analyzeHeadings(pages: CrawledPage[], issues: SEOIssue[]): HeadingsAnalysis {
  let multipleH1 = 0;
  let missingH1 = 0;
  let improperHierarchy = 0;
  const h1Lengths: number[] = [];

  for (const page of pages) {
    const h1Count = page.headings.h1.length;

    if (h1Count === 0) {
      missingH1++;
    } else if (h1Count > 1) {
      multipleH1++;
    }

    if (h1Count > 0) {
      h1Lengths.push(...page.headings.h1.map((h) => h.length));
    }

    // Check hierarchy (H2 should come after H1, etc.)
    if (h1Count === 0 && page.headings.h2.length > 0) {
      improperHierarchy++;
    }
  }

  const analysis: HeadingsAnalysis = {
    hasH1: pages.some((p) => p.headings.h1.length > 0),
    multipleH1,
    missingH1,
    properHierarchy: improperHierarchy === 0,
    averageH1Length: h1Lengths.length > 0 ? Math.round(h1Lengths.reduce((a, b) => a + b, 0) / h1Lengths.length) : 0,
  };

  if (missingH1 > 0) {
    issues.push({
      type: 'error',
      category: 'Headings',
      message: `${missingH1} page(s) missing H1 heading`,
      affectedPages: pages.filter((p) => p.headings.h1.length === 0).map((p) => p.url),
      recommendation: 'Add a single H1 heading to each page describing the main topic',
    });
  }

  if (multipleH1 > 0) {
    issues.push({
      type: 'warning',
      category: 'Headings',
      message: `${multipleH1} page(s) have multiple H1 headings`,
      recommendation: 'Use only one H1 per page',
    });
  }

  if (!analysis.properHierarchy) {
    issues.push({
      type: 'info',
      category: 'Headings',
      message: 'Some pages have improper heading hierarchy',
      recommendation: 'Structure headings hierarchically (H1 → H2 → H3)',
    });
  }

  return analysis;
}

function calculateHeadingsScore(analysis: HeadingsAnalysis): number {
  let score = 100;

  if (!analysis.hasH1) score -= 30;
  score -= analysis.missingH1 * 5;
  score -= analysis.multipleH1 * 3;
  if (!analysis.properHierarchy) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ============================================
// IMAGES ANALYSIS
// ============================================

function analyzeImages(pages: CrawledPage[], issues: SEOIssue[]): ImagesAnalysis {
  let totalImages = 0;
  let withoutAlt = 0;
  let withAlt = 0;
  let lazyLoaded = 0;

  for (const page of pages) {
    totalImages += page.images.length;
    for (const img of page.images) {
      if (img.alt && img.alt.trim()) {
        withAlt++;
      } else {
        withoutAlt++;
      }
      if (img.isLazyLoaded) {
        lazyLoaded++;
      }
    }
  }

  const analysis: ImagesAnalysis = {
    totalImages,
    withoutAlt,
    withAlt,
    lazyLoaded,
    altPercentage: totalImages > 0 ? Math.round((withAlt / totalImages) * 100) : 100,
  };

  if (withoutAlt > 0) {
    const severity = analysis.altPercentage < 50 ? 'error' : 'warning';
    issues.push({
      type: severity,
      category: 'Images',
      message: `${withoutAlt} image(s) missing alt text (${100 - analysis.altPercentage}%)`,
      recommendation: 'Add descriptive alt text to all images for accessibility and SEO',
    });
  }

  if (totalImages > 0 && lazyLoaded === 0) {
    issues.push({
      type: 'info',
      category: 'Images',
      message: 'No lazy-loaded images detected',
      recommendation: 'Consider lazy loading images to improve page load speed',
    });
  }

  return analysis;
}

function calculateImagesScore(analysis: ImagesAnalysis): number {
  return analysis.altPercentage;
}

// ============================================
// LINKS ANALYSIS
// ============================================

function analyzeLinks(pages: CrawledPage[], issues: SEOIssue[]): LinksAnalysis {
  let totalLinks = 0;
  let internalLinks = 0;
  let externalLinks = 0;
  let nofollow = 0;

  for (const page of pages) {
    totalLinks += page.links.length;
    for (const link of page.links) {
      if (link.isExternal) {
        externalLinks++;
      } else {
        internalLinks++;
      }
      if (link.isNofollow) {
        nofollow++;
      }
    }
  }

  const analysis: LinksAnalysis = {
    totalLinks,
    internalLinks,
    externalLinks,
    brokenLinks: 0, // Would require additional crawling to detect
    nofollow,
  };

  if (internalLinks === 0 && pages.length > 1) {
    issues.push({
      type: 'warning',
      category: 'Links',
      message: 'No internal links detected',
      recommendation: 'Add internal links to improve site navigation and SEO',
    });
  }

  const externalRatio = totalLinks > 0 ? externalLinks / totalLinks : 0;
  if (externalRatio > 0.5) {
    issues.push({
      type: 'info',
      category: 'Links',
      message: 'High ratio of external links',
      recommendation: 'Balance external links with internal links',
    });
  }

  return analysis;
}

function calculateLinksScore(analysis: LinksAnalysis): number {
  let score = 100;

  if (analysis.internalLinks === 0) score -= 30;
  if (analysis.brokenLinks > 0) score -= analysis.brokenLinks * 5;

  return Math.max(0, Math.min(100, score));
}

// ============================================
// CONTENT ANALYSIS
// ============================================

function analyzeContent(pages: CrawledPage[], issues: SEOIssue[]): ContentAnalysis {
  const wordCounts = pages.map((p) => p.wordCount);
  const thinContentThreshold = 300;

  const analysis: ContentAnalysis = {
    averageWordCount: wordCounts.length > 0 ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length) : 0,
    thinContent: wordCounts.filter((w) => w < thinContentThreshold).length,
    duplicateContent: 0, // Would require content comparison
  };

  if (analysis.thinContent > 0) {
    const percentage = Math.round((analysis.thinContent / pages.length) * 100);
    issues.push({
      type: percentage > 50 ? 'error' : 'warning',
      category: 'Content',
      message: `${analysis.thinContent} page(s) have thin content (< ${thinContentThreshold} words)`,
      affectedPages: pages.filter((p) => p.wordCount < thinContentThreshold).map((p) => p.url),
      recommendation: 'Add more valuable content to thin pages',
    });
  }

  if (analysis.averageWordCount < 500) {
    issues.push({
      type: 'info',
      category: 'Content',
      message: `Average content length is ${analysis.averageWordCount} words`,
      recommendation: 'Consider expanding content for better SEO (aim for 1000+ words for key pages)',
    });
  }

  return analysis;
}

function calculateContentScore(analysis: ContentAnalysis): number {
  let score = 100;

  if (analysis.averageWordCount < 300) score -= 30;
  else if (analysis.averageWordCount < 500) score -= 15;

  score -= analysis.thinContent * 3;
  score -= analysis.duplicateContent * 5;

  return Math.max(0, Math.min(100, score));
}

// ============================================
// TECHNICAL ANALYSIS
// ============================================

function analyzeTechnical(pages: CrawledPage[], issues: SEOIssue[]): number {
  let score = 100;

  // Check for canonical URLs
  const withCanonical = pages.filter((p) => p.seo.canonicalUrl).length;
  if (withCanonical < pages.length * 0.5) {
    issues.push({
      type: 'warning',
      category: 'Technical',
      message: 'Many pages missing canonical URL',
      recommendation: 'Add canonical tags to prevent duplicate content issues',
    });
    score -= 15;
  }

  // Check for Open Graph
  const withOG = pages.filter((p) => p.seo.ogTitle || p.seo.ogDescription).length;
  if (withOG < pages.length * 0.5) {
    issues.push({
      type: 'info',
      category: 'Social',
      message: 'Many pages missing Open Graph tags',
      recommendation: 'Add OG tags for better social media sharing',
    });
    score -= 10;
  }

  // Check for structured data
  const withSchema = pages.filter((p) => p.seo.hasStructuredData).length;
  if (withSchema === 0) {
    issues.push({
      type: 'info',
      category: 'Structured Data',
      message: 'No structured data (Schema.org) detected',
      recommendation: 'Add structured data for rich search results',
    });
    score -= 10;
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================
// INSIGHTS GENERATION
// ============================================

function generateInsights(
  pages: CrawledPage[],
  titleAnalysis: TitleAnalysis,
  descriptionAnalysis: DescriptionAnalysis,
  headingsAnalysis: HeadingsAnalysis,
  imagesAnalysis: ImagesAnalysis,
  linksAnalysis: LinksAnalysis,
  contentAnalysis: ContentAnalysis,
  opportunities: string[],
  strengths: string[]
): void {
  // Strengths
  if (titleAnalysis.missing === 0) {
    strengths.push('All pages have title tags');
  }
  if (descriptionAnalysis.missing === 0) {
    strengths.push('All pages have meta descriptions');
  }
  if (headingsAnalysis.missingH1 === 0) {
    strengths.push('All pages have H1 headings');
  }
  if (imagesAnalysis.altPercentage >= 90) {
    strengths.push('Excellent image alt text coverage');
  }
  if (contentAnalysis.averageWordCount >= 1000) {
    strengths.push('Strong content depth with good word count');
  }
  if (linksAnalysis.internalLinks > linksAnalysis.externalLinks) {
    strengths.push('Good internal linking structure');
  }

  // Opportunities
  if (titleAnalysis.duplicates > 0) {
    opportunities.push('Create unique titles for duplicate pages to improve rankings');
  }
  if (descriptionAnalysis.duplicates > 0) {
    opportunities.push('Write unique descriptions for each page');
  }
  if (imagesAnalysis.altPercentage < 80) {
    opportunities.push('Add alt text to images for accessibility and image search');
  }
  if (contentAnalysis.thinContent > 0) {
    opportunities.push('Expand thin content pages with valuable information');
  }
  if (linksAnalysis.internalLinks < pages.length * 3) {
    opportunities.push('Improve internal linking to help search engines discover content');
  }
  if (!pages.some((p) => p.seo.hasStructuredData)) {
    opportunities.push('Implement structured data for rich snippets in search results');
  }
}

// ============================================
// EXPORT HELPERS
// ============================================

/**
 * Get severity color for issue
 */
export function getIssueSeverityColor(type: SEOIssue['type']): string {
  switch (type) {
    case 'error':
      return 'red';
    case 'warning':
      return 'yellow';
    case 'info':
      return 'blue';
    default:
      return 'gray';
  }
}

/**
 * Get score color
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}

/**
 * Get score label
 */
export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Needs Improvement';
  if (score >= 40) return 'Poor';
  return 'Critical';
}
