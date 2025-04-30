// background.js

// Helper: Prune logs older than 30 days
function pruneOldLogs(logs) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return logs.filter(record => record.timestamp >= cutoff);
}

// Listen to every full page load on any tab
chrome.webNavigation.onCompleted.addListener(async details => {
    if (details.frameId !== 0) return;

    // Get the domain from URL
    const url = new URL(details.url);
    const domain = url.hostname;

    // Inject script to grab navigation timing
    const [entry] = await chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        func: () => performance.getEntriesByType('navigation')[0]
    });

    if (!entry) return;
    const loadTime = entry.loadEventStart - entry.startTime; // ms

    // Store record with timestamp
    chrome.storage.local.get({ logs: [] }, ({ logs }) => {
        logs = pruneOldLogs(logs);
        logs.push({ domain, timestamp: Date.now(), loadTime });
        chrome.storage.local.set({ logs });
    });
});
