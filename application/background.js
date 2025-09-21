// background.js

// Keep only the last 365 days of logs (1 year)
function pruneOldLogs(logs) {
  const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000;
  return logs.filter((r) => r.timestamp >= cutoff);
}

function formatDuration(ms) {
  if (typeof ms !== "number" || isNaN(ms)) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (ms < 60000) return `${s.toFixed(1)}s`;
  const m = ms / 60000;
  if (ms < 3600000) return `${Math.round(m)}m`;
  const h = ms / 3600000;
  return `${Math.round(h)}h`;
}

// Track one live timer interval per tab to avoid duplicate/flickering counters
const tabIntervals = new Map(); // tabId -> { intervalId, domain }

function clearTabInterval(tabId) {
  const rec = tabIntervals.get(tabId);
  if (rec && rec.intervalId) {
    try {
      clearInterval(rec.intervalId);
    } catch {}
  }
  tabIntervals.delete(tabId);
}

function removeCurrentLoadForTab(currentLoads, tabId) {
  let removedDomain = null;
  for (const domain in currentLoads) {
    if (currentLoads[domain][tabId]) {
      delete currentLoads[domain][tabId];
      if (Object.keys(currentLoads[domain]).length === 0) {
        delete currentLoads[domain];
      }
      removedDomain = domain;
      break;
    }
  }
  return removedDomain;
}

// Helper function to clean up dead tabs in currentLoads
function cleanDeadTabs(currentLoads) {
  chrome.tabs.query({}, (tabs) => {
    const activeTabIds = tabs.map((tab) => tab.id); // Get all active tab IDs
    for (const domain in currentLoads) {
      for (const tabId in currentLoads[domain]) {
        if (!activeTabIds.includes(Number(tabId))) {
          delete currentLoads[domain][tabId]; // Remove dead tab entry
        }
      }
      if (Object.keys(currentLoads[domain]).length === 0) {
        delete currentLoads[domain]; // Remove domain if no tabs remain
      }
    }
    chrome.storage.local.set({ currentLoads }); // Save cleaned state
  });
}

// 1) On navigation start, stamp the timestamp for live counting
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0) return; // Ignore subframes
  const newDomain = new URL(details.url).hostname;

  chrome.storage.local.get(
    { tracked: [], currentLoads: {}, recentLoads: {} },
    (data) => {
      const tracked = data.tracked || [];

      const currentLoads = { ...data.currentLoads };
      const recentLoads = { ...data.recentLoads };

      // Clean up dead tabs before updating currentLoads
      cleanDeadTabs(currentLoads);

      // If this tab had a previous load entry for a different domain, remove it and stop its timer (leaving/redirect)
      const prevDomain = Object.keys(currentLoads).find(
        (d) => currentLoads[d][details.tabId]
      );
      if (prevDomain && prevDomain !== newDomain) {
        delete currentLoads[prevDomain][details.tabId];
        if (Object.keys(currentLoads[prevDomain]).length === 0)
          delete currentLoads[prevDomain];
        clearTabInterval(details.tabId);
        chrome.action.setBadgeText({ text: "" });
      }

      // Only start a new timer if the new domain is tracked
      if (!tracked.includes(newDomain)) {
        chrome.storage.local.set({ currentLoads, recentLoads });
        return;
      }

      if (!currentLoads[newDomain]) {
        currentLoads[newDomain] = {}; // Initialize as an object for tab-specific tracking
      }
      currentLoads[newDomain][details.tabId] = Date.now(); // Store timestamp per tab ID

      // Clear the recent load time for the domain
      delete recentLoads[newDomain];

      // Start the badge counter
      chrome.action.setBadgeBackgroundColor({ color: "#87CEEB" }); // Light blue color for better visibility

      // Save the updated state immediately
      chrome.storage.local.set({ currentLoads, recentLoads });

      const startTime = currentLoads[newDomain][details.tabId];
      // Ensure we only have one live interval per tab
      clearTabInterval(details.tabId);
      const intervalId = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime;

        // Update the badge with the live count for the active tab in the current window
        chrome.windows.getCurrent((window) => {
          chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
            tabs.forEach((tab) => {
              if (tab.id === details.tabId) {
                chrome.action.setBadgeText({ text: formatDuration(elapsed) });
              }
            });
          });
        });

        // Check if navigation is still in progress
        chrome.storage.local.get({ currentLoads: {} }, (updatedData) => {
          if (!updatedData.currentLoads[newDomain]?.[details.tabId]) {
            clearInterval(intervalId); // Stop updating if navigation is complete
            clearTabInterval(details.tabId);
          }
        });
      }, 100); // Update every 100ms

      tabIntervals.set(details.tabId, { intervalId, domain: newDomain });
    }
  );
});

// Detect if a tab leaves a tracked domain (redirects to external site) and stop/discard timer
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return; // Ignore subframes
  const newDomain = new URL(details.url).hostname;
  chrome.storage.local.get({ tracked: [], currentLoads: {} }, (data) => {
    const { tracked, currentLoads } = data;
    // If the new domain is NOT tracked, but there was a timer running for this tab on a tracked domain, stop and discard it
    for (const domain in currentLoads) {
      if (currentLoads[domain][details.tabId] && domain !== newDomain) {
        // Tab left the tracked domain (redirected to external site)
        delete currentLoads[domain][details.tabId];
        if (Object.keys(currentLoads[domain]).length === 0) {
          delete currentLoads[domain];
        }
        chrome.storage.local.set({ currentLoads });
        // Optionally clear badge for this tab
        chrome.action.setBadgeText({ text: "" });
        clearTabInterval(details.tabId);
      }
    }
  });
});

// Stop and discard if navigation aborted (network error or user cancel)
chrome.webNavigation.onErrorOccurred.addListener((details) => {
  if (details.frameId !== 0) return; // Ignore subframes
  chrome.storage.local.get({ currentLoads: {} }, (data) => {
    const currentLoads = { ...data.currentLoads };
    const removedDomain = removeCurrentLoadForTab(currentLoads, details.tabId);
    if (removedDomain) {
      chrome.storage.local.set({ currentLoads });
      clearTabInterval(details.tabId);
      chrome.action.setBadgeText({ text: "" });
    }
  });
});

// 2) On navigation complete, compute and persist loadTime + timestamp
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId !== 0) return; // Ignore subframes
  const domain = new URL(details.url).hostname;

  chrome.storage.local.get(
    { tracked: [], currentLoads: {}, logs: [], recentLoads: {} },
    (data) => {
      const { tracked, currentLoads, logs, recentLoads } = data;
      if (!tracked.includes(domain)) return; // Only track if the domain is being tracked

      const domainLoads = currentLoads[domain];
      if (!domainLoads || !domainLoads[details.tabId]) return; // No start time for this tab

      const startTime = domainLoads[details.tabId];

      // Attempt high-precision timing via the Performance API
      chrome.scripting
        .executeScript({
          target: { tabId: details.tabId },
          func: () => {
            const nav = performance.getEntriesByType("navigation")[0];
            return nav ? nav.loadEventStart - nav.startTime : null;
          },
        })
        .then((results) => {
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
          if (typeof loadTime === "number" && !isNaN(loadTime)) {
            pruned.push({
              domain,
              timestamp: Date.now(),
              loadTime,
              hourWindow: Math.floor(Date.now() / (60 * 60 * 1000)),
              dayWindow: Math.floor(Date.now() / (24 * 60 * 60 * 1000)),
              weekWindow: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)),
              monthWindow: Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000)),
              yearWindow: new Date().getFullYear(),
            });
          }

          chrome.storage.local.set({ currentLoads, logs: pruned, recentLoads });

          // Update the badge with the final load time for the active tab
          chrome.windows.getCurrent((window) => {
            chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
              tabs.forEach((tab) => {
                if (tab.id === details.tabId) {
                  chrome.action.setBadgeText({
                    text: formatDuration(loadTime),
                  });
                }
              });
            });
          });
          clearTabInterval(details.tabId);
        })
        .catch(() => {
          // In the unlikely event scripting.executeScript fails,
          // fall back to our own timestamp diff:
          const loadTime = Date.now() - startTime;

          delete domainLoads[details.tabId];
          if (Object.keys(domainLoads).length === 0) {
            delete currentLoads[domain];
          }

          recentLoads[domain] = loadTime;

          const pruned = pruneOldLogs(logs);
          if (typeof loadTime === "number" && !isNaN(loadTime)) {
            pruned.push({
              domain,
              timestamp: Date.now(),
              loadTime,
              hourWindow: Math.floor(Date.now() / (60 * 60 * 1000)),
              dayWindow: Math.floor(Date.now() / (24 * 60 * 60 * 1000)),
              weekWindow: Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)),
              monthWindow: Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000)),
              yearWindow: new Date().getFullYear(),
            });
          }

          chrome.storage.local.set({ currentLoads, logs: pruned, recentLoads });

          // Update the badge with the final load time for the active tab
          chrome.windows.getCurrent((window) => {
            chrome.tabs.query({ active: true, windowId: window.id }, (tabs) => {
              tabs.forEach((tab) => {
                if (tab.id === details.tabId) {
                  chrome.action.setBadgeText({
                    text: formatDuration(loadTime),
                  });
                }
              });
            });
          });
          clearTabInterval(details.tabId);
        });
    }
  );
});

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get({ currentLoads: {}, recentLoads: {} }, (data) => {
    const currentLoads = { ...data.currentLoads };
    const recentLoads = { ...data.recentLoads };

    // Clear any stale entries in currentLoads and recentLoads
    for (const domain in currentLoads) {
      if (Object.keys(currentLoads[domain]).length === 0) {
        delete currentLoads[domain];
        delete recentLoads[domain];
      }
    }

    chrome.storage.local.set({ currentLoads, recentLoads });
  });
});

chrome.tabs.onActivated.addListener(() => {
  chrome.action.setBadgeText({ text: "" }); // Clear the badge
});

// 3) Handle tab removal
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get(
    { currentLoads: {}, recentLoads: {}, tracked: [] },
    (data) => {
      const currentLoads = { ...data.currentLoads };
      const recentLoads = { ...data.recentLoads };

      // Find the domain associated with the closed tab
      let domainToRemove = null;
      for (const domain in currentLoads) {
        if (currentLoads[domain][tabId]) {
          delete currentLoads[domain][tabId];
          if (Object.keys(currentLoads[domain]).length === 0) {
            domainToRemove = domain; // Mark domain for removal if no tabs remain
          }
          break;
        }
      }

      if (domainToRemove) {
        delete currentLoads[domainToRemove];
        delete recentLoads[domainToRemove]; // Clear recentLoads for the domain
      }

      chrome.storage.local.set({ currentLoads, recentLoads });
    }
  );

  // Clear the badge if the closed tab was the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length || tabs[0].id === tabId) {
      chrome.action.setBadgeText({ text: "" });
    }
  });
  clearTabInterval(tabId);
});

// Handle prerender/Instant Pages tab replacement
chrome.webNavigation.onTabReplaced.addListener((details) => {
  // details.replacedTabId was replaced by details.tabId
  chrome.storage.local.get({ currentLoads: {} }, (data) => {
    const currentLoads = { ...data.currentLoads };
    const removedDomain = removeCurrentLoadForTab(
      currentLoads,
      details.replacedTabId
    );
    if (removedDomain) {
      chrome.storage.local.set({ currentLoads });
    }
  });
  clearTabInterval(details.replacedTabId);
  chrome.action.setBadgeText({ text: "" });
});
