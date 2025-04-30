// background.js

//
// Helper: drop logs older than 30 days
//
function pruneOldLogs(logs) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return logs.filter(r => r.timestamp >= cutoff);
}

//
// 1) When any tracked domain **starts navigating**, stamp its start time.
//
chrome.webNavigation.onBeforeNavigate.addListener(details => {
    if (details.frameId !== 0) return;                 // only main frame
    const domain = new URL(details.url).hostname;

    chrome.storage.local.get({ tracked: [], currentLoads: {} }, data => {
        if (!data.tracked.includes(domain)) return;
        data.currentLoads[domain] = Date.now();
        chrome.storage.local.set({ currentLoads: data.currentLoads });
    });
});

//
// 2) When that same page **finishes**, compute the final duration & log it.
//
chrome.webNavigation.onCompleted.addListener(async details => {
    if (details.frameId !== 0) return;
    const domain = new URL(details.url).hostname;

    // Fetch tracked list & any in-flight start time
    const { tracked = [], currentLoads = {} } =
        await chrome.storage.local.get(['tracked', 'currentLoads']);

    if (!tracked.includes(domain)) return;

    // Try the high-precision PerformanceTiming entry
    let loadTime = null;
    try {
        const [entry] = await chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            func: () => performance.getEntriesByType('navigation')[0]
        });
        if (entry) loadTime = entry.loadEventStart - entry.startTime;
    } catch (e) {/*ignore*/ }

    // Fallback: use our onBeforeNavigate timestamp
    const start = currentLoads[domain];
    if (loadTime === null && typeof start === 'number') {
        loadTime = Date.now() - start;
    }

    // Clean up in-flight
    delete currentLoads[domain];
    chrome.storage.local.set({ currentLoads });

    // If we got a valid number, persist it
    if (typeof loadTime === 'number' && !isNaN(loadTime)) {
        chrome.storage.local.get({ logs: [] }, data => {
            const logs = pruneOldLogs(data.logs);
            logs.push({ domain, timestamp: Date.now(), loadTime });
            chrome.storage.local.set({ logs });
        });
    }
});
