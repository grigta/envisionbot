// ============================================
// TECH PATTERNS DATABASE
// ============================================
const TECH_PATTERNS = [
    // ========== CMS ==========
    {
        name: 'WordPress',
        category: 'cms',
        patterns: [
            { type: 'html', pattern: /wp-content|wp-includes/i },
            { type: 'meta', selector: 'meta[name="generator"]', pattern: /WordPress/i },
            { type: 'script', pattern: /wp-content\/|wp-includes\//i },
            { type: 'header', headerName: 'x-powered-by', pattern: /WordPress/i },
        ],
        version: { type: 'meta', selector: 'meta[name="generator"]', pattern: /WordPress\s*([\d.]+)/i },
        website: 'https://wordpress.org',
    },
    {
        name: 'Shopify',
        category: 'ecommerce',
        patterns: [
            { type: 'script', pattern: /cdn\.shopify\.com/i },
            { type: 'html', pattern: /Shopify\.theme|shopify-section/i },
            { type: 'header', headerName: 'x-shopify-stage', pattern: /.+/ },
        ],
        website: 'https://shopify.com',
    },
    {
        name: 'Tilda',
        category: 'cms',
        patterns: [
            { type: 'script', pattern: /tilda\.ws|tildacdn\.com/i },
            { type: 'html', pattern: /tilda-page-id|t-records/i },
            { type: 'meta', selector: 'meta[name="generator"]', pattern: /Tilda/i },
        ],
        website: 'https://tilda.cc',
    },
    {
        name: 'Wix',
        category: 'cms',
        patterns: [
            { type: 'script', pattern: /static\.wixstatic\.com|wix\.com/i },
            { type: 'html', pattern: /wix-dropdown-menu|_wixCustom/i },
            { type: 'meta', selector: 'meta[name="generator"]', pattern: /Wix/i },
        ],
        website: 'https://wix.com',
    },
    {
        name: 'Squarespace',
        category: 'cms',
        patterns: [
            { type: 'script', pattern: /squarespace\.com|static1\.squarespace/i },
            { type: 'html', pattern: /squarespace-cdn|sqs-block/i },
        ],
        website: 'https://squarespace.com',
    },
    {
        name: 'Webflow',
        category: 'cms',
        patterns: [
            { type: 'script', pattern: /webflow\.com|assets\.website-files\.com/i },
            { type: 'html', pattern: /w-nav|w-slider|w-form/i },
            { type: 'meta', selector: 'meta[name="generator"]', pattern: /Webflow/i },
        ],
        website: 'https://webflow.com',
    },
    {
        name: 'Drupal',
        category: 'cms',
        patterns: [
            { type: 'html', pattern: /Drupal\.settings|drupal\.js/i },
            { type: 'meta', selector: 'meta[name="generator"]', pattern: /Drupal/i },
            { type: 'header', headerName: 'x-drupal-cache', pattern: /.+/ },
        ],
        version: { type: 'meta', selector: 'meta[name="generator"]', pattern: /Drupal\s*([\d.]+)/i },
        website: 'https://drupal.org',
    },
    {
        name: 'Joomla',
        category: 'cms',
        patterns: [
            { type: 'meta', selector: 'meta[name="generator"]', pattern: /Joomla/i },
            { type: 'script', pattern: /media\/jui\/js/i },
        ],
        version: { type: 'meta', selector: 'meta[name="generator"]', pattern: /Joomla!\s*([\d.]+)/i },
        website: 'https://joomla.org',
    },
    {
        name: '1C-Bitrix',
        category: 'cms',
        patterns: [
            { type: 'script', pattern: /bitrix\/js|bitrix\/templates/i },
            { type: 'html', pattern: /BX\.message|bitrix_sessid/i },
            { type: 'meta', selector: 'meta[name="generator"]', pattern: /Bitrix/i },
        ],
        website: 'https://www.1c-bitrix.ru',
    },
    // ========== JavaScript Frameworks ==========
    {
        name: 'React',
        category: 'javascript-framework',
        patterns: [
            { type: 'html', pattern: /data-reactroot|data-reactid|__REACT_DEVTOOLS/i },
            { type: 'script', pattern: /react(?:\.production|\.development)?\.min\.js|react-dom/i },
        ],
        website: 'https://react.dev',
    },
    {
        name: 'Next.js',
        category: 'javascript-framework',
        patterns: [
            { type: 'html', pattern: /__NEXT_DATA__|_next\/static/i },
            { type: 'script', pattern: /_next\/static/i },
            { type: 'header', headerName: 'x-powered-by', pattern: /Next\.js/i },
        ],
        website: 'https://nextjs.org',
    },
    {
        name: 'Vue.js',
        category: 'javascript-framework',
        patterns: [
            { type: 'html', pattern: /data-v-[a-f0-9]+|__vue__/i },
            { type: 'script', pattern: /vue(?:\.runtime)?(?:\.esm)?(?:\.min)?\.js/i },
        ],
        website: 'https://vuejs.org',
    },
    {
        name: 'Nuxt.js',
        category: 'javascript-framework',
        patterns: [
            { type: 'html', pattern: /__NUXT__|nuxt-link|nuxt-child/i },
            { type: 'script', pattern: /_nuxt\//i },
        ],
        website: 'https://nuxt.com',
    },
    {
        name: 'Angular',
        category: 'javascript-framework',
        patterns: [
            { type: 'html', pattern: /ng-version|ng-app|ng-controller|\[ngClass\]/i },
            { type: 'script', pattern: /angular(?:\.min)?\.js|zone\.js/i },
        ],
        website: 'https://angular.io',
    },
    {
        name: 'Svelte',
        category: 'javascript-framework',
        patterns: [
            { type: 'html', pattern: /svelte-[a-z0-9]+/i },
            { type: 'script', pattern: /svelte\.min\.js/i },
        ],
        website: 'https://svelte.dev',
    },
    {
        name: 'jQuery',
        category: 'javascript-framework',
        patterns: [
            { type: 'script', pattern: /jquery(?:\.min)?\.js|jquery-[\d.]+/i },
            { type: 'html', pattern: /\$\(document\)|jQuery\(/i },
        ],
        website: 'https://jquery.com',
    },
    // ========== CSS Frameworks ==========
    {
        name: 'Bootstrap',
        category: 'css-framework',
        patterns: [
            { type: 'html', pattern: /class="[^"]*\b(container|row|col-|btn-|navbar)\b/i },
            { type: 'script', pattern: /bootstrap(?:\.bundle)?(?:\.min)?\.js/i },
        ],
        website: 'https://getbootstrap.com',
    },
    {
        name: 'Tailwind CSS',
        category: 'css-framework',
        patterns: [
            { type: 'html', pattern: /class="[^"]*\b(flex|grid|p-\d|m-\d|text-|bg-|border-)\b/i },
        ],
        website: 'https://tailwindcss.com',
    },
    {
        name: 'Material UI',
        category: 'css-framework',
        patterns: [
            { type: 'html', pattern: /MuiButton|MuiPaper|MuiTypography/i },
            { type: 'script', pattern: /@mui\/material/i },
        ],
        website: 'https://mui.com',
    },
    // ========== Analytics ==========
    {
        name: 'Google Analytics',
        category: 'analytics',
        patterns: [
            { type: 'script', pattern: /google-analytics\.com\/analytics|googletagmanager\.com\/gtag/i },
            { type: 'html', pattern: /gtag\(|ga\('create'|_gaq\.push/i },
        ],
        website: 'https://analytics.google.com',
    },
    {
        name: 'Google Tag Manager',
        category: 'analytics',
        patterns: [
            { type: 'script', pattern: /googletagmanager\.com\/gtm/i },
            { type: 'html', pattern: /GTM-[A-Z0-9]+/i },
        ],
        website: 'https://tagmanager.google.com',
    },
    {
        name: 'Yandex Metrika',
        category: 'analytics',
        patterns: [
            { type: 'script', pattern: /mc\.yandex\.ru\/metrika|cdn\.jsdelivr\.net\/npm\/yandex-metrica-watch/i },
            { type: 'html', pattern: /ym\(\d+,|yaCounter\d+/i },
        ],
        website: 'https://metrika.yandex.ru',
    },
    {
        name: 'Hotjar',
        category: 'analytics',
        patterns: [
            { type: 'script', pattern: /static\.hotjar\.com|hotjar\.com\/c\/hotjar/i },
            { type: 'html', pattern: /hjSiteSettings|hj\('trigger'/i },
        ],
        website: 'https://hotjar.com',
    },
    {
        name: 'Mixpanel',
        category: 'analytics',
        patterns: [
            { type: 'script', pattern: /cdn\.mxpnl\.com|mixpanel\.com\/libs/i },
            { type: 'html', pattern: /mixpanel\.init|mixpanel\.track/i },
        ],
        website: 'https://mixpanel.com',
    },
    {
        name: 'Amplitude',
        category: 'analytics',
        patterns: [
            { type: 'script', pattern: /cdn\.amplitude\.com|amplitude\.getInstance/i },
        ],
        website: 'https://amplitude.com',
    },
    // ========== Marketing & Pixels ==========
    {
        name: 'Facebook Pixel',
        category: 'pixel',
        patterns: [
            { type: 'script', pattern: /connect\.facebook\.net.*fbevents|facebook\.com\/tr\?/i },
            { type: 'html', pattern: /fbq\('init'|_fbq/i },
        ],
        website: 'https://www.facebook.com/business/tools/meta-pixel',
    },
    {
        name: 'Google Ads',
        category: 'advertising',
        patterns: [
            { type: 'script', pattern: /googleads\.g\.doubleclick\.net|googlesyndication\.com/i },
            { type: 'html', pattern: /gtag\('config',\s*'AW-/i },
        ],
        website: 'https://ads.google.com',
    },
    {
        name: 'LinkedIn Insight',
        category: 'pixel',
        patterns: [
            { type: 'script', pattern: /snap\.licdn\.com|linkedin\.com\/px/i },
            { type: 'html', pattern: /_linkedin_partner_id/i },
        ],
        website: 'https://linkedin.com',
    },
    {
        name: 'Twitter Pixel',
        category: 'pixel',
        patterns: [
            { type: 'script', pattern: /static\.ads-twitter\.com|analytics\.twitter\.com/i },
            { type: 'html', pattern: /twq\('init'/i },
        ],
        website: 'https://ads.twitter.com',
    },
    {
        name: 'TikTok Pixel',
        category: 'pixel',
        patterns: [
            { type: 'script', pattern: /analytics\.tiktok\.com/i },
            { type: 'html', pattern: /ttq\.load/i },
        ],
        website: 'https://ads.tiktok.com',
    },
    {
        name: 'HubSpot',
        category: 'marketing',
        patterns: [
            { type: 'script', pattern: /js\.hs-scripts\.com|js\.hubspot\.com/i },
            { type: 'html', pattern: /_hsq\.push|hbspt\.forms/i },
        ],
        website: 'https://hubspot.com',
    },
    {
        name: 'Mailchimp',
        category: 'marketing',
        patterns: [
            { type: 'script', pattern: /chimpstatic\.com|list-manage\.com/i },
        ],
        website: 'https://mailchimp.com',
    },
    // ========== Chat & Support ==========
    {
        name: 'Intercom',
        category: 'chat',
        patterns: [
            { type: 'script', pattern: /widget\.intercom\.io|intercomcdn\.com/i },
            { type: 'html', pattern: /Intercom\('boot'|intercomSettings/i },
        ],
        website: 'https://intercom.com',
    },
    {
        name: 'Zendesk',
        category: 'chat',
        patterns: [
            { type: 'script', pattern: /static\.zdassets\.com|zopim\.com/i },
            { type: 'html', pattern: /zE\('webWidget'|$zopim/i },
        ],
        website: 'https://zendesk.com',
    },
    {
        name: 'Drift',
        category: 'chat',
        patterns: [
            { type: 'script', pattern: /js\.driftt\.com|drift\.com/i },
            { type: 'html', pattern: /drift\.load|driftt\.com/i },
        ],
        website: 'https://drift.com',
    },
    {
        name: 'LiveChat',
        category: 'chat',
        patterns: [
            { type: 'script', pattern: /cdn\.livechatinc\.com|secure\.livechatinc\.com/i },
        ],
        website: 'https://livechat.com',
    },
    {
        name: 'Crisp',
        category: 'chat',
        patterns: [
            { type: 'script', pattern: /client\.crisp\.chat/i },
            { type: 'html', pattern: /\$crisp\.push|CRISP_WEBSITE_ID/i },
        ],
        website: 'https://crisp.chat',
    },
    {
        name: 'JivoChat',
        category: 'chat',
        patterns: [
            { type: 'script', pattern: /code\.jivosite\.com|cdn-widget\.jivo\.ru/i },
        ],
        website: 'https://jivochat.com',
    },
    // ========== CDN & Hosting ==========
    {
        name: 'Cloudflare',
        category: 'cdn',
        patterns: [
            { type: 'header', headerName: 'cf-ray', pattern: /.+/ },
            { type: 'header', headerName: 'server', pattern: /cloudflare/i },
            { type: 'script', pattern: /cdnjs\.cloudflare\.com/i },
        ],
        website: 'https://cloudflare.com',
    },
    {
        name: 'Vercel',
        category: 'hosting',
        patterns: [
            { type: 'header', headerName: 'x-vercel-id', pattern: /.+/ },
            { type: 'header', headerName: 'server', pattern: /Vercel/i },
        ],
        website: 'https://vercel.com',
    },
    {
        name: 'Netlify',
        category: 'hosting',
        patterns: [
            { type: 'header', headerName: 'x-nf-request-id', pattern: /.+/ },
            { type: 'header', headerName: 'server', pattern: /Netlify/i },
        ],
        website: 'https://netlify.com',
    },
    {
        name: 'AWS CloudFront',
        category: 'cdn',
        patterns: [
            { type: 'header', headerName: 'x-amz-cf-id', pattern: /.+/ },
            { type: 'header', headerName: 'via', pattern: /CloudFront/i },
        ],
        website: 'https://aws.amazon.com/cloudfront',
    },
    {
        name: 'Fastly',
        category: 'cdn',
        patterns: [
            { type: 'header', headerName: 'x-served-by', pattern: /cache-/i },
            { type: 'header', headerName: 'via', pattern: /Fastly/i },
        ],
        website: 'https://fastly.com',
    },
    // ========== Payment ==========
    {
        name: 'Stripe',
        category: 'payment',
        patterns: [
            { type: 'script', pattern: /js\.stripe\.com/i },
            { type: 'html', pattern: /Stripe\(|stripe\.redirectToCheckout/i },
        ],
        website: 'https://stripe.com',
    },
    {
        name: 'PayPal',
        category: 'payment',
        patterns: [
            { type: 'script', pattern: /paypal\.com\/sdk|paypalobjects\.com/i },
        ],
        website: 'https://paypal.com',
    },
    // ========== Security ==========
    {
        name: 'reCAPTCHA',
        category: 'security',
        patterns: [
            { type: 'script', pattern: /google\.com\/recaptcha|gstatic\.com\/recaptcha/i },
            { type: 'html', pattern: /g-recaptcha|grecaptcha\./i },
        ],
        website: 'https://www.google.com/recaptcha',
    },
    {
        name: 'hCaptcha',
        category: 'security',
        patterns: [
            { type: 'script', pattern: /hcaptcha\.com\/1\/api\.js/i },
            { type: 'html', pattern: /h-captcha/i },
        ],
        website: 'https://hcaptcha.com',
    },
    // ========== Performance ==========
    {
        name: 'Cloudinary',
        category: 'performance',
        patterns: [
            { type: 'script', pattern: /cloudinary\.com|res\.cloudinary\.com/i },
        ],
        website: 'https://cloudinary.com',
    },
    {
        name: 'Imgix',
        category: 'performance',
        patterns: [
            { type: 'html', pattern: /\.imgix\.net/i },
        ],
        website: 'https://imgix.com',
    },
    // ========== Fonts ==========
    {
        name: 'Google Fonts',
        category: 'font',
        patterns: [
            { type: 'html', pattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/i },
        ],
        website: 'https://fonts.google.com',
    },
    {
        name: 'Adobe Fonts',
        category: 'font',
        patterns: [
            { type: 'html', pattern: /use\.typekit\.net/i },
        ],
        website: 'https://fonts.adobe.com',
    },
];
// ============================================
// DETECTION FUNCTIONS
// ============================================
/**
 * Detect technologies from context
 */
export function detectTechStack(context) {
    const detected = [];
    const foundTechs = new Set();
    for (const tech of TECH_PATTERNS) {
        if (foundTechs.has(tech.name))
            continue;
        let confidence = 0;
        let detectedBy = 'pattern';
        let evidence;
        for (const patternRule of tech.patterns) {
            const matchResult = matchPattern(patternRule, context);
            if (matchResult.matched) {
                confidence = Math.max(confidence, matchResult.confidence);
                detectedBy = patternRule.type;
                evidence = matchResult.evidence;
            }
        }
        if (confidence > 0) {
            // Try to extract version
            let version;
            if (tech.version) {
                const versionMatch = matchPattern(tech.version, context);
                if (versionMatch.matched && versionMatch.version) {
                    version = versionMatch.version;
                }
            }
            detected.push({
                category: tech.category,
                name: tech.name,
                version,
                confidence,
                detectedBy,
                evidence,
                website: tech.website,
            });
            foundTechs.add(tech.name);
        }
    }
    // Sort by confidence
    return detected.sort((a, b) => b.confidence - a.confidence);
}
function matchPattern(rule, context) {
    const result = { matched: false, confidence: 0 };
    switch (rule.type) {
        case 'header': {
            if (rule.headerName && rule.pattern) {
                const headerValue = context.headers[rule.headerName.toLowerCase()];
                if (headerValue && rule.pattern.test(headerValue)) {
                    result.matched = true;
                    result.confidence = 90;
                    result.evidence = `Header: ${rule.headerName}`;
                    const versionMatch = headerValue.match(rule.pattern);
                    if (versionMatch?.[1])
                        result.version = versionMatch[1];
                }
            }
            break;
        }
        case 'script': {
            if (rule.pattern) {
                for (const script of context.scripts) {
                    if (rule.pattern.test(script)) {
                        result.matched = true;
                        result.confidence = 85;
                        result.evidence = `Script: ${script.substring(0, 100)}`;
                        break;
                    }
                }
                // Also check in HTML
                if (!result.matched && rule.pattern.test(context.html)) {
                    result.matched = true;
                    result.confidence = 80;
                    result.evidence = 'Found in HTML';
                }
            }
            break;
        }
        case 'html': {
            if (rule.pattern && rule.pattern.test(context.html)) {
                result.matched = true;
                result.confidence = 75;
                const match = context.html.match(rule.pattern);
                result.evidence = match ? `Pattern: ${match[0].substring(0, 50)}` : 'HTML pattern match';
                if (match?.[1])
                    result.version = match[1];
            }
            break;
        }
        case 'meta': {
            if (rule.selector && rule.pattern) {
                // Simple selector parsing for meta tags
                const metaMatch = context.html.match(new RegExp(`<meta[^>]*name=["']${rule.selector.split('"')[1]}["'][^>]*content=["']([^"']+)["']`, 'i'));
                if (metaMatch && rule.pattern.test(metaMatch[1])) {
                    result.matched = true;
                    result.confidence = 95;
                    result.evidence = `Meta: ${metaMatch[1]}`;
                    const versionMatch = metaMatch[1].match(rule.pattern);
                    if (versionMatch?.[1])
                        result.version = versionMatch[1];
                }
            }
            break;
        }
        case 'cookie': {
            if (rule.cookieName && context.cookies.includes(rule.cookieName)) {
                result.matched = true;
                result.confidence = 70;
                result.evidence = `Cookie: ${rule.cookieName}`;
            }
            break;
        }
    }
    return result;
}
/**
 * Group tech stack by category
 */
export function groupByCategory(techStack) {
    const grouped = {};
    for (const tech of techStack) {
        if (!grouped[tech.category]) {
            grouped[tech.category] = [];
        }
        grouped[tech.category].push(tech);
    }
    return grouped;
}
/**
 * Get human-readable category name
 */
export function getCategoryLabel(category) {
    const labels = {
        cms: 'CMS',
        framework: 'Framework',
        'javascript-framework': 'JavaScript Framework',
        'css-framework': 'CSS Framework',
        analytics: 'Analytics',
        marketing: 'Marketing',
        advertising: 'Advertising',
        pixel: 'Tracking Pixel',
        chat: 'Chat & Support',
        cdn: 'CDN',
        hosting: 'Hosting',
        ecommerce: 'E-commerce',
        payment: 'Payment',
        security: 'Security',
        performance: 'Performance',
        video: 'Video',
        font: 'Fonts',
        database: 'Database',
        server: 'Server',
        'programming-language': 'Programming Language',
        other: 'Other',
    };
    return labels[category] || category;
}
//# sourceMappingURL=tech-detector.js.map