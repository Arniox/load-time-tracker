// background.js

// Prune logs older than 30 days
function pruneOldLogs(logs) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return logs.filter(r => r.timestamp >= cutoff);
}

// When a tracked domain starts navigation, record start timestamp
chrome.webNavigation.onBeforeNavigate.addListener(details => {
    if (details.frameId !== 0) return;
    const domain = new URL(details.url).hostname;

    chrome.storage.local.get({ tracked: [], currentLoads: {} }, ({ tracked, currentLoads }) => {
        if (!tracked.includes(domain)) return;
        currentLoads[domain] = Date.now();
        chrome.storage.local.set({ currentLoads });
    });
});

// When it finishes, compute loadTime and log it
chrome.webNavigation.onCompleted.addListener(async details => {
    if (details.frameId !== 0) return;
    const domain = new URL(details.url).hostname;

    // Only care about tracked domains
    const { tracked = [], currentLoads = {} } = await chrome.storage.local.get(['tracked', 'currentLoads']);
    if (!tracked.includes(domain)) return;

    // Grab the navigation timing (best precision)
    let loadTime = null;
    try {
        const [entry] = await chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            func: () => performance.getEntriesByType('navigation')[0]
        });
        if (entry) {
            loadTime = entry.loadEventStart - entry.startTime;
        }
    } catch { }

    // Fallback to our timestamp diff if Performance API failed
    const start = currentLoads[domain];
    if (loadTime === null && typeof start === 'number') {
        loadTime = Date.now() - start;
    }
    if (typeof loadTime !== 'number' || isNaN(loadTime)) {
        // nothing sensible to log
        delete currentLoads[domain];
        chrome.storage.local.set({ currentLoads });
        return;
    }

    // Clear the in-flight record
    delete currentLoads[domain];
    chrome.storage.local.set({ currentLoads });

    // Persist into logs
    chrome.storage.local.get({ logs: [] }, ({ logs }) => {
        logs = pruneOldLogs(logs);
        logs.push({ domain, timestamp: Date.now(), loadTime });
        chrome.storage.local.set({ logs });
    });
});
