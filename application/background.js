// background.js

// Keep only the last 30 days of logs
function pruneOldLogs(logs) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return logs.filter(r => r.timestamp >= cutoff);
}

// 1) On navigation start, stamp the timestamp for live counting
chrome.webNavigation.onBeforeNavigate.addListener(details => {
    if (details.frameId !== 0) return; // Ignore subframes
    const domain = new URL(details.url).hostname;

    chrome.storage.local.get(
        { tracked: [], currentLoads: {} },
        data => {
            if (!data.tracked.includes(domain)) return; // Only track if the domain is being tracked

            const currentLoads = { ...data.currentLoads };
            if (!currentLoads[domain]) {
                currentLoads[domain] = {}; // Initialize as an object for tab-specific tracking
            }
            currentLoads[domain][details.tabId] = Date.now(); // Store timestamp per tab ID

            // Atomically update currentLoads
            chrome.storage.local.set({ currentLoads });
        }
    );
});

// 2) On navigation complete, compute and persist loadTime + timestamp
chrome.webNavigation.onCompleted.addListener(details => {
    if (details.frameId !== 0) return; // Ignore subframes
    const domain = new URL(details.url).hostname;

    chrome.storage.local.get({ tracked: [], currentLoads: {}, logs: [], recentLoads: {} }, data => {
        const { tracked, currentLoads, logs, recentLoads } = data;
        if (!tracked.includes(domain)) return; // Only track if the domain is being tracked

        const domainLoads = currentLoads[domain];
        if (!domainLoads || !domainLoads[details.tabId]) return; // No start time for this tab

        const startTime = domainLoads[details.tabId];

        // Attempt high-precision timing via the Performance API
        chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            func: () => {
                const nav = performance.getEntriesByType('navigation')[0];
                return nav ? nav.loadEventStart - nav.startTime : null;
            }
        }).then(results => {
            let loadTime = results?.[0]?.result;

            // Fallback: use our own timestamp if Performance API returned null
            if (loadTime == null) {
                loadTime = Date.now() - startTime;
            }

            // Remove the tab-specific entry
            delete domainLoads[details.tabId];
            if (Object.keys(domainLoads).length === 0) {
                delete currentLoads[domain]; // Clean up if no tabs are left for this domain
            }

            // Update recentLoads with the most recent load time
            recentLoads[domain] = loadTime;

            // Atomically update currentLoads, logs, and recentLoads
            const pruned = pruneOldLogs(logs);
            if (typeof loadTime === 'number' && !isNaN(loadTime)) {
                pruned.push({
                    domain,
                    timestamp: Date.now(),
                    loadTime,
                    hourWindow: Math.floor(Date.now() / (60 * 60 * 1000)),
                    dayWindow: Math.floor(Date.now() / (24 * 60 * 60 * 1000)),
                    weekWindow: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)),
                    monthWindow: Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000))
                });
            }

            chrome.storage.local.set({ currentLoads, logs: pruned, recentLoads });
        }).catch(() => {
            // In the unlikely event scripting.executeScript fails,
            // fall back to our own timestamp diff:
            const loadTime = Date.now() - startTime;

            delete domainLoads[details.tabId];
            if (Object.keys(domainLoads).length === 0) {
                delete currentLoads[domain];
            }

            recentLoads[domain] = loadTime;

            const pruned = pruneOldLogs(logs);
            if (typeof loadTime === 'number' && !isNaN(loadTime)) {
                pruned.push({
                    domain,
                    timestamp: Date.now(),
                    loadTime,
                    hourWindow: Math.floor(Date.now() / (60 * 60 * 1000)),
                    dayWindow: Math.floor(Date.now() / (24 * 60 * 60 * 1000)),
                    weekWindow: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)),
                    monthWindow: Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000))
                });
            }

            chrome.storage.local.set({ currentLoads, logs: pruned, recentLoads });
        });
    });
});