// content.js
(() => {
    const link = document.querySelector('link[rel*="icon"]');
    if (!link?.href) return;

    let href = link.href;
    // If href is protocol-relative or path-relative, normalize it:
    if (href.startsWith('//')) {
        href = window.location.protocol + href;
    } else if (href.startsWith('/')) {
        href = window.location.origin + href;
    }

    const domain = window.location.hostname;
    chrome.storage.local.get({ icons: {} }, ({ icons }) => {
        // Only store the first one we see
        if (!icons[domain]) {
            icons[domain] = href;
            chrome.storage.local.set({ icons });
        }
    });
})();
