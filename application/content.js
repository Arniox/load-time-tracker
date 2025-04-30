// content.js
(() => {
    console.log('Content script loaded for:', window.location.href);

    function extractFaviconUrl() {
        const selectors = [
            'link[rel="icon"]',
            'link[rel="shortcut icon"]',
            'link[rel="apple-touch-icon"]',
            'link[rel="apple-touch-icon-precomposed"]',
            'link[rel*="icon"]'
        ];

        let href = null;
        for (const selector of selectors) {
            const link = document.querySelector(selector);
            if (link?.href) {
                href = link.href;
                break;
            }
        }

        if (!href) return null;

        if (href.startsWith('//')) {
            href = window.location.protocol + href;
        } else if (href.startsWith('/')) {
            href = window.location.origin + href;
        } else if (!href.match(/^https?:\/\//)) {
            const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
            href = base + href;
        }

        console.log('Found favicon URL:', href);
        return href;
    }

    const domain = window.location.hostname;
    const faviconUrl = extractFaviconUrl();

    chrome.storage.local.get({ icons: {} }, ({ icons }) => {
        if (faviconUrl) {
            console.log(`Storing favicon for ${domain}: ${faviconUrl}`);
            icons[domain] = faviconUrl;
            chrome.storage.local.set({ icons }, () => {
                // Notify that favicon scraping is complete
                chrome.runtime.sendMessage({ type: 'favicon-scraped', domain });
            });
        } else {
            console.log(`No favicon found for ${domain}`);
            chrome.runtime.sendMessage({ type: 'favicon-scraped', domain });
        }
    });
})();