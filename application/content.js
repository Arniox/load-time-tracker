// content.js
(() => {
  // console.log('Content script loaded for:', window.location.href);

  function extractFaviconUrl() {
    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
      'link[rel*="icon"]',
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

    if (href.startsWith("//")) {
      href = window.location.protocol + href;
    } else if (href.startsWith("/")) {
      href = window.location.origin + href;
    } else if (!href.match(/^https?:\/\//)) {
      const base = window.location.href.substring(
        0,
        window.location.href.lastIndexOf("/") + 1
      );
      href = base + href;
    }

    // console.log('Found favicon URL:', href);
    return href;
  }

  const domain = window.location.hostname;
  const faviconUrl = extractFaviconUrl();

  chrome.storage.local.get({ icons: {} }, ({ icons }) => {
    if (faviconUrl) {
      // console.log(`Storing favicon for ${domain}: ${faviconUrl}`);
      icons[domain] = faviconUrl;
      chrome.storage.local.set({ icons }, () => {
        // Notify that favicon scraping is complete
        chrome.runtime.sendMessage({ type: "favicon-scraped", domain });
      });
    } else {
      // console.log(`No favicon found for ${domain}`);
      chrome.runtime.sendMessage({ type: "favicon-scraped", domain });
    }
  });
  // ===== On-page overlay chip =====
  const OVERLAY_ID = "__ltt_overlay_chip__";
  let overlayEl = null;
  let overlayVisible = false;

  function ensureOverlay() {
    if (!overlayEl) {
      overlayEl = document.createElement("div");
      overlayEl.id = OVERLAY_ID;
      overlayEl.style.position = "fixed";
      overlayEl.style.zIndex = "2147483647";
      overlayEl.style.right = "10px";
      overlayEl.style.bottom = "10px";
      overlayEl.style.background = "rgba(20,20,20,0.85)";
      overlayEl.style.color = "#fff";
      overlayEl.style.font = "12px/1.2 -apple-system,Segoe UI,Arial,sans-serif";
      overlayEl.style.padding = "6px 8px";
      overlayEl.style.borderRadius = "14px";
      overlayEl.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
      overlayEl.style.pointerEvents = "none";
      overlayEl.style.maxWidth = "60vw";
      overlayEl.style.whiteSpace = "nowrap";
      overlayEl.textContent = "Load Time Tracker";
      document.documentElement.appendChild(overlayEl);
    }
    return overlayEl;
  }

  function setOverlayVisibility(show) {
    overlayVisible = !!show;
    if (overlayVisible) {
      ensureOverlay().style.display = "block";
    } else if (overlayEl) {
      overlayEl.style.display = "none";
    }
  }

  function computeStats(logs, domain) {
    const ds = logs
      .filter((r) => r.domain === domain)
      .map((r) => r.loadTime)
      .filter((x) => typeof x === "number" && !isNaN(x));
    if (!ds.length) return { last: null, avg: null, p95: null };
    const last = ds[ds.length - 1];
    const avg = ds.reduce((a, b) => a + b, 0) / ds.length;
    const sorted = [...ds].sort((a, b) => a - b);
    const rank = 0.95 * (sorted.length - 1);
    const lo = Math.floor(rank),
      hi = Math.ceil(rank);
    const p95 =
      lo === hi
        ? sorted[lo]
        : sorted[lo] * (1 - (rank - lo)) + sorted[hi] * (rank - lo);
    return { last, avg, p95 };
  }

  function short(ms) {
    if (ms == null || isNaN(ms)) return "—";
    if (ms < 10000) return (ms / 1000).toFixed(1) + "s";
    if (ms < 60000) return Math.floor(ms / 1000) + "s";
    const m = Math.floor(ms / 60000);
    return m + "m";
  }

  function refreshOverlay() {
    chrome.storage.local.get(
      { settings: {}, logs: [], recentLoads: {} },
      (data) => {
        const settings = data.settings || {};
        const globalOn = !!settings.overlayGlobal;
        const per = settings.overlayPerDomain || {};
        const allowed = per.hasOwnProperty(domain) ? !!per[domain] : globalOn;
        setOverlayVisibility(allowed);
        if (!allowed) return;
        const stats = computeStats(data.logs || [], domain);
        const last = (data.recentLoads || {})[domain] ?? stats.last;
        const text = `L ${short(last)}  •  avg ${short(stats.avg)}`;
        ensureOverlay().textContent = text;
      }
    );
  }

  // initial paint and keep it updated
  refreshOverlay();
  const refreshInterval = setInterval(refreshOverlay, 1500);

  // Listen for storage changes to toggle instantly
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.settings || changes.logs || changes.recentLoads) {
      refreshOverlay();
    }
  });

  window.addEventListener("pagehide", () => clearInterval(refreshInterval));
})();
