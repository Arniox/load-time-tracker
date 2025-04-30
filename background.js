// background.js

// Keep only the last 30 days of logs
function pruneOldLogs(logs) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return logs.filter(r => r.timestamp >= cutoff);
}

// 1) On navigation start, stamp the timestamp for live counting
chrome.webNavigation.onBeforeNavigate.addListener(details => {
    if (details.frameId !== 0) return;
    const domain = new URL(details.url).hostname;

    chrome.storage.local.get(
        { tracked: [], currentLoads: {} },
        data => {
            // Only track if the domain is already being tracked (not first time)
            if (!data.tracked.includes(domain)) return;
            data.currentLoads[domain] = Date.now();
            chrome.storage.local.set({ currentLoads: data.currentLoads });
        }
    );
});

// 2) On navigation complete, compute and persist loadTime + timestamp
chrome.webNavigation.onCompleted.addListener(details => {
    if (details.frameId !== 0) return;
    const domain = new URL(details.url).hostname;

    // Retrieve everything we need in one call
    chrome.storage.local.get(
        { tracked: [], currentLoads: {}, logs: [] },
        data => {
            const { tracked, currentLoads, logs } = data;
            if (!tracked.includes(domain)) {
                // not tracking this site
                return;
            }

            // If there's no start time, this might be the first load after adding the site
            // In that case, we don't want to track this load
            if (!currentLoads[domain]) {
                return;
            }

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
                    const start = currentLoads[domain];
                    loadTime = typeof start === 'number'
                        ? Date.now() - start
                        : null;
                }

                // Clear the in-flight entry
                delete data.currentLoads[domain];
                chrome.storage.local.set({ currentLoads: data.currentLoads });

                // Only log if we actually got a number
                if (typeof loadTime === 'number' && !isNaN(loadTime)) {
                    const pruned = pruneOldLogs(logs);
                    pruned.push({
                        domain,
                        timestamp: Date.now(),
                        loadTime,
                        hourWindow: Math.floor(Date.now() / (60 * 60 * 1000)),
                        dayWindow: Math.floor(Date.now() / (24 * 60 * 60 * 1000)),
                        weekWindow: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)),
                        monthWindow: Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000))
                    });
                    chrome.storage.local.set({ logs: pruned });
                }
            }).catch(() => {
                // In the unlikely event scripting.executeScript fails,
                // fall back to our own timestamp diff:
                const start = currentLoads[domain];
                const loadTime = typeof start === 'number'
                    ? (Date.now() - start)
                    : null;

                delete data.currentLoads[domain];
                chrome.storage.local.set({ currentLoads: data.currentLoads });

                if (typeof loadTime === 'number' && !isNaN(loadTime)) {
                    const pruned = pruneOldLogs(logs);
                    pruned.push({
                        domain,
                        timestamp: Date.now(),
                        loadTime,
                        hourWindow: Math.floor(Date.now() / (60 * 60 * 1000)),
                        dayWindow: Math.floor(Date.now() / (24 * 60 * 60 * 1000)),
                        weekWindow: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)),
                        monthWindow: Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000))
                    });
                    chrome.storage.local.set({ logs: pruned });
                }
            });
        }
    );
});