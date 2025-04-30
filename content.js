// content.js
(() => {
    // Function to extract and normalize favicon URL
    function extractFaviconUrl() {
        // Check for common favicon link tags in order of preference
        const selectors = [
            'link[rel="icon"]',
            'link[rel="shortcut icon"]',
            'link[rel="apple-touch-icon"]',
            'link[rel="apple-touch-icon-precomposed"]',
            'link[rel*="icon"]'  // Catch other variants like 'fluid-icon', etc.
        ];

        let href = null;

        // Try each selector until we find a match
        for (const selector of selectors) {
            const link = document.querySelector(selector);
            if (link?.href) {
                href = link.href;
                break;
            }
        }

        // If no link tag found, return null
        if (!href) return null;

        // Normalize the URL (handle relative URLs)
        if (href.startsWith('//')) {
            // Protocol-relative URL
            href = window.location.protocol + href;
        } else if (href.startsWith('/')) {
            // Path-relative URL
            href = window.location.origin + href;
        } else if (!href.match(/^https?:\/\//)) {
            // Relative to current path
            const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
            href = base + href;
        }

        return href;
    }

    // Now try to get the favicon URL
    const domain = window.location.hostname;
    const faviconUrl = extractFaviconUrl();

    // Store the favicon URL if found
    if (faviconUrl) {
        chrome.storage.local.get({ icons: {} }, ({ icons }) => {
            // Only store the first one we see for a domain
            if (!icons[domain]) {
                console.log(`Found favicon for ${domain}: ${faviconUrl}`);
                icons[domain] = faviconUrl;
                chrome.storage.local.set({ icons });
            }
        });
    }
})();