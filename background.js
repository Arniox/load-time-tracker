// background.js

// Prune older than 30 days
function pruneOldLogs(logs) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return logs.filter(r => r.timestamp >= cutoff);
}

chrome.webNavigation.onCompleted.addListener(async details => {
    if (details.frameId !== 0) return;

    const url = new URL(details.url);
    const domain = url.hostname;

    // 1) Only log if domain is in our tracked list
    const { tracked = [] } = await chrome.storage.local.get('tracked');
    if (!tracked.includes(domain)) return;

    // 2) Grab the navigation entry
    const [entry] = await chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        func: () => performance.getEntriesByType('navigation')[0]
    });
    if (!entry) return;

    const loadTime = entry.loadEventStart - entry.startTime;

    // 3) Persist into logs
    chrome.storage.local.get({ logs: [] }, ({ logs }) => {
        logs = pruneOldLogs(logs);
        logs.push({ domain, timestamp: Date.now(), loadTime });
        chrome.storage.local.set({ logs });
    });
});
