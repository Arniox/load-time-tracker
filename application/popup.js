// popup.js

const siteList = document.getElementById("siteList");
const addBtn = document.getElementById("addBtn");
const overlayGlobalBtn = document.getElementById("overlayGlobalBtn");
let running = true;

//
// Convert a millisecond total into your desired unit format
//
function formatDuration(ms) {
  if (typeof ms !== "number" || isNaN(ms)) return "0ms";
  if (ms < 1000) return `${Math.round(ms)}ms`; // Round ms to the nearest integer
  const s = ms / 1000;
  if (ms < 10000) return `${s.toFixed(2)}s`;
  if (ms < 60000) return `${Math.round(s)}s`;
  const m = ms / 60000;
  if (ms < 3600000) return `${Math.round(m)}m`;
  const h = ms / 3600000;
  return `${Math.round(h)}h`;
}

//
// Get time aggregates for a specific time window
//
function getTimeInWindow(logs, domain, windowType) {
  const now = new Date(); // Use Date object for precise calculations
  const currentTimestamp = now.getTime();

  // Calculate the start of the current hour, day, week, and month
  const startOfHour = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours()
  ).getTime();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startOfWeek = new Date(
    startOfDay -
      (now.getDay() === 0 ? 6 : now.getDay() - 1) * 24 * 60 * 60 * 1000
  ).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime(); // Jan 1st, 00:00

  // Determine the start time for the given window type
  let startTime;
  switch (windowType) {
    case "h": // Current hour
      startTime = startOfHour;
      break;
    case "d": // Current day
      startTime = startOfDay; // Start at 12:00 AM
      break;
    case "w": // Current week
      startTime = startOfWeek; // Start at 12:00 AM on Monday
      break;
    case "m": // Current month
      startTime = startOfMonth;
      break;
    case "y": // Current year
      startTime = startOfYear; // Start at 12:00 AM on Jan 1st
      break;
    default:
      console.error(`Invalid window type: ${windowType}`);
      return 0;
  }

  // Filter logs for the specific domain and time window
  return logs
    .filter(
      (r) =>
        r.domain === domain &&
        r.timestamp >= startTime &&
        r.timestamp <= currentTimestamp
    )
    .reduce((sum, r) => sum + (r.loadTime || 0), 0);
}

// Percentile helper
function percentile(values, p) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  if (p <= 0) return sorted[0];
  if (p >= 100) return sorted[sorted.length - 1];
  const rank = (p / 100) * (sorted.length - 1);
  const low = Math.floor(rank),
    high = Math.ceil(rank);
  if (low === high) return sorted[low];
  const w = rank - low;
  return sorted[low] * (1 - w) + sorted[high] * w;
}

function computeStats(logs, domain) {
  const arr = logs
    .filter((r) => r.domain === domain)
    .map((r) => r.loadTime)
    .filter((v) => typeof v === "number" && !isNaN(v));
  const last = arr.length ? arr[arr.length - 1] : 0;
  const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const p50 = arr.length ? percentile(arr, 50) : 0; // kept for future use
  return { last, avg, p50 };
}

function short(ms) {
  if (ms == null || isNaN(ms)) return "—";
  if (ms < 10000) return (ms / 1000).toFixed(1) + "s";
  if (ms < 60000) return Math.floor(ms / 1000) + "s";
  const m = Math.floor(ms / 60000);
  return m + "m";
}

function drawSparkline(canvas, rawPoints) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width,
    h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  if (!rawPoints || rawPoints.length === 0) return;

  // Visual constants
  const pad = 2; // top/bottom/right padding (right-aligned)
  const minSpacing = 2; // px between points (min)
  const maxSpacing = 5; // px between points (max)
  const fadeWidth = 14; // px fade to white from the left edge
  const stroke = "#4CAF50";

  // Filter to numeric values only
  let points = rawPoints.filter((v) => typeof v === "number" && !isNaN(v));
  if (points.length === 0) return;

  // Capacity based on minimum spacing (right-aligned to always show the most recent)
  const innerWidth = Math.max(0, w - 2 * pad);
  const capacity = Math.max(1, Math.floor(innerWidth / minSpacing) + 1);
  if (points.length > capacity) {
    points = points.slice(-capacity);
  }

  const count = points.length;

  // Compute spacing, then right-align the series so the latest value is at the right
  // If too few points, spacing grows but is capped to avoid overly stretched lines
  let spacing = count > 1 ? Math.floor(innerWidth / (count - 1)) : innerWidth;
  spacing = Math.min(maxSpacing, Math.max(minSpacing, spacing));
  const xRight = w - pad;

  // Y mapping
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);

  // Draw the line (or a dot when only one point)
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  if (count === 1) {
    const y = h - pad - ((points[0] - min) * (h - 2 * pad)) / range;
    const x = xRight; // single point at the right edge
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = stroke;
    ctx.fill();
  } else {
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const v = points[i];
      const x = xRight - spacing * (count - 1 - i);
      const y = h - pad - ((v - min) * (h - 2 * pad)) / range;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Left-side fade to white (overlay a gradient from opaque white to transparent)
  const grad = ctx.createLinearGradient(0, 0, fadeWidth, 0);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, fadeWidth, h);
}

// Function to create and append a favicon image element
function createFaviconElement(domain, icons) {
  const img = document.createElement("img");
  img.className = "favicon";
  img.alt = domain;

  // Default to a placeholder icon
  const defaultIcon =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23ddd"/><text x="50%" y="50%" font-family="Arial" font-size="40" fill="%23555" text-anchor="middle" dominant-baseline="central">' +
    domain.charAt(0).toUpperCase() +
    "</text></svg>";

  // Check if the icon is already stored
  chrome.storage.local.get({ icons: {} }, ({ icons }) => {
    const storedIcon = icons[domain];

    if (storedIcon) {
      // Use the stored icon if available
      img.src = storedIcon;

      // Set fallback if the stored icon fails
      img.onerror = () => {
        tryFaviconFallbacks(img, domain, defaultIcon, icons);
      };
    } else {
      // If no stored icon, try fallbacks immediately
      tryFaviconFallbacks(img, domain, defaultIcon, icons);
    }
  });

  return img;
}

// Helper function to attempt fallback favicon sources and save the result
function tryFaviconFallbacks(img, domain, defaultIcon, icons) {
  const fallbacks = [
    `https://${domain}/favicon.ico`,
    `https://${domain}/favicon.png`,
    `https://${domain}/apple-touch-icon.png`,
    defaultIcon,
  ];

  let currentFallback = 0;

  function tryNextFallback() {
    if (currentFallback < fallbacks.length) {
      const fallbackUrl = fallbacks[currentFallback];
      img.src = fallbackUrl;

      img.onload = () => {
        // Save the successfully loaded icon into storage
        chrome.storage.local.get({ icons: {} }, ({ icons }) => {
          icons[domain] = fallbackUrl;
          chrome.storage.local.set({ icons });
        });
      };

      img.onerror = () => {
        currentFallback++;
        tryNextFallback();
      };
    }
  }

  tryNextFallback();
}

// Function to properly remove a site from tracking
function removeSite(domain) {
  chrome.storage.local.get(
    ["tracked", "logs", "currentLoads", "icons", "settings"],
    (data) => {
      // Filter out the domain from the tracked list
      const tracked = (data.tracked || []).filter((x) => x !== domain);

      // Filter out all logs for this domain
      const logs = (data.logs || []).filter((r) => r.domain !== domain);

      // Remove any in-flight loads
      const currentLoads = { ...(data.currentLoads || {}) };
      delete currentLoads[domain];

      // Remove icon if stored
      const icons = { ...(data.icons || {}) };
      delete icons[domain];

      // Remove per-domain overlay toggle if present
      const settings = { ...(data.settings || {}) };
      if (
        settings.overlayPerDomain &&
        Object.prototype.hasOwnProperty.call(settings.overlayPerDomain, domain)
      ) {
        const per = { ...settings.overlayPerDomain };
        delete per[domain];
        settings.overlayPerDomain = per;
      }

      // Debug data after changes
      console.log("After removal preparation:", {
        tracked,
        logCount: logs.length,
        currentLoads,
        icons,
        settings,
      });

      // Update storage with all the cleaned data
      chrome.storage.local.set(
        { tracked, logs, currentLoads, icons, settings },
        () => {
          renderSiteList(); // Only re-render the list after storage changes
        }
      );
    }
  );
}

// Initial rendering of the site list
function renderSiteList() {
  chrome.storage.local.get(
    ["tracked", "logs", "icons", "currentLoads", "settings"],
    (data) => {
      const tracked = data.tracked || [];
      const logs = data.logs || [];
      const icons = data.icons || {};
      const currentLoads = data.currentLoads || {};
      const settings = data.settings || {};

      // Initialize global overlay button (mass toggle all per-domain flags)
      if (overlayGlobalBtn) {
        const refreshBtnState = (tracked, per) => {
          const anyOn = tracked.some((d) => per && per[d]);
          overlayGlobalBtn.classList.toggle("on", anyOn);
          overlayGlobalBtn.setAttribute(
            "aria-pressed",
            anyOn ? "true" : "false"
          );
        };

        refreshBtnState(tracked, settings.overlayPerDomain || {});

        overlayGlobalBtn.onclick = () => {
          chrome.storage.local.get(
            { tracked: [], settings: {} },
            ({ tracked, settings }) => {
              const per = { ...(settings.overlayPerDomain || {}) };
              const anyOn = tracked.some((d) => per[d]);
              const nextVal = !anyOn; // if any are on, turn all off; otherwise, turn all on
              tracked.forEach((d) => {
                per[d] = nextVal;
              });
              chrome.storage.local.set(
                { settings: { ...settings, overlayPerDomain: per } },
                () => {
                  // Update global button based on new state (anyOn after change === nextVal if tracked not empty)
                  refreshBtnState(tracked, per);
                  // Immediately reflect visual state of all per-domain buttons
                  tracked.forEach((d) => {
                    const btn = siteList.querySelector(
                      `li[data-domain="${d}"] .overlayToggleBtn`
                    );
                    if (btn) {
                      btn.classList.toggle("on", !!per[d]);
                      btn.setAttribute(
                        "aria-pressed",
                        per[d] ? "true" : "false"
                      );
                    }
                  });
                }
              );
            }
          );
        };
      }

      // Use a Map to track existing list items
      const existingItems = new Map();
      siteList.querySelectorAll("li").forEach((li) => {
        existingItems.set(li.dataset.domain, li);
      });

      tracked.forEach((domain) => {
        let li = existingItems.get(domain);

        if (!li) {
          // Create a new list item if it doesn't exist
          li = document.createElement("li");
          li.dataset.domain = domain;

          // Favicon with robust fallback handling
          const img = createFaviconElement(domain, icons);

          // Domain + stats block
          const info = document.createElement("div");
          info.className = "info";

          // Add domain
          const domainSpan = document.createElement("span");
          domainSpan.className = "domain";
          domainSpan.textContent = domain;

          // Add stats container (will be updated by updateStats)
          const statsSpan = document.createElement("span");
          statsSpan.className = "stats";
          statsSpan.dataset.domain = domain;

          // Add secondary stats container for "Now" and "Avg"
          const secondStatsSpan = document.createElement("span");
          secondStatsSpan.className = "secondary-stats";
          secondStatsSpan.dataset.domain = domain;

          info.appendChild(domainSpan);
          info.appendChild(statsSpan);
          info.appendChild(secondStatsSpan);

          // Right side controls: sparkline + overlay toggle + remove
          const right = document.createElement("div");
          right.className = "right-side";

          const canvas = document.createElement("canvas");
          canvas.className = "sparkline";
          canvas.width = 64;
          canvas.height = 24;
          canvas.dataset.domain = domain;

          const overlayToggle = document.createElement("button");
          overlayToggle.className = "overlayToggleBtn";
          overlayToggle.title = "Overlay on this domain";
          const setOverlayBtn = (on) => {
            overlayToggle.classList.toggle("on", !!on);
            overlayToggle.setAttribute("aria-pressed", on ? "true" : "false");
          };
          setOverlayBtn(
            !!(settings.overlayPerDomain && settings.overlayPerDomain[domain])
          );
          overlayToggle.addEventListener("click", () => {
            chrome.storage.local.get(
              { settings: {}, tracked: [] },
              ({ settings, tracked }) => {
                const per = { ...(settings.overlayPerDomain || {}) };
                const newVal = !per[domain];
                per[domain] = newVal;
                chrome.storage.local.set(
                  { settings: { ...settings, overlayPerDomain: per } },
                  () => {
                    setOverlayBtn(newVal);
                    // Reflect change in global button: ON if any tracked are ON; OFF if all are OFF
                    if (overlayGlobalBtn) {
                      const anyOn = tracked.some((d) => per[d]);
                      overlayGlobalBtn.classList.toggle("on", anyOn);
                      overlayGlobalBtn.setAttribute(
                        "aria-pressed",
                        anyOn ? "true" : "false"
                      );
                    }
                  }
                );
              }
            );
          });

          // Remove button
          const rm = document.createElement("button");
          rm.className = "removeBtn";
          rm.textContent = "×";
          rm.title = "Stop tracking";
          rm.dataset.domain = domain;
          rm.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            removeSite(this.dataset.domain);
            return false;
          });

          right.appendChild(canvas);
          right.appendChild(overlayToggle);
          right.appendChild(rm);

          li.append(img, info, right);
          siteList.append(li);
        }

        // Remove from the map to track which items are still valid
        existingItems.delete(domain);
      });

      // Remove any items that are no longer tracked
      existingItems.forEach((li, domain) => {
        li.remove();
      });

      // Do an initial stats update
      updateStats();
    }
  );
}

// Only update the stats in existing list items
function updateStats() {
  chrome.storage.local.get(
    ["tracked", "logs", "currentLoads", "recentLoads"],
    (data) => {
      const logs = data.logs || [];
      const currentLoads = data.currentLoads || {};
      const recentLoads = data.recentLoads || {};
      const now = Date.now();

      // Cache stats elements to avoid repeated DOM queries
      const statsElements = new Map();
      document.querySelectorAll(".stats[data-domain]").forEach((el) => {
        statsElements.set(el.dataset.domain, el);
      });

      const secondStatsElements = new Map();
      document
        .querySelectorAll(".secondary-stats[data-domain]")
        .forEach((el) => {
          secondStatsElements.set(el.dataset.domain, el);
        });

      data.tracked.forEach((domain) => {
        const statsElement = statsElements.get(domain);
        const secondStatsElement = secondStatsElements.get(domain);
        if (!statsElement || !secondStatsElement) return;

        // Calculate aggregates for each time window
        const totals = {
          h: getTimeInWindow(logs, domain, "h", currentLoads[domain]),
          d: getTimeInWindow(logs, domain, "d", currentLoads[domain]),
          w: getTimeInWindow(logs, domain, "w", currentLoads[domain]),
          m: getTimeInWindow(logs, domain, "m", currentLoads[domain]),
          y: getTimeInWindow(logs, domain, "y", currentLoads[domain]),
        };

        // Include live duration for all tabs of the domain
        const domainLoads = currentLoads[domain];
        let nowTime = 0;
        if (domainLoads) {
          Object.values(domainLoads).forEach((startTime) => {
            if (typeof startTime === "number") {
              const liveDuration = now - startTime;
              nowTime += liveDuration;
              totals.h += liveDuration;
              totals.d += liveDuration;
              totals.w += liveDuration;
              totals.m += liveDuration;
              totals.y += liveDuration;
            }
          });
        } else if (recentLoads[domain]) {
          nowTime = recentLoads[domain];
        }

        // Update main stats line
        const stats = [
          `H ${formatDuration(totals.h)}`,
          `D ${formatDuration(totals.d)}`,
          `W ${formatDuration(totals.w)}`,
          `M ${formatDuration(totals.m)}`,
          `Y ${formatDuration(totals.y)}`,
        ].join(" | ");
        statsElement.textContent = stats;

        // Secondary stats: Last only
        const s = computeStats(logs, domain);
        const last = recentLoads[domain] ?? s.last;
        secondStatsElement.textContent = `Last ${short(last)}`;

        // Sparkline of the last X loads (right-aligned, dynamic 2–5px spacing)
        const li = siteList.querySelector(`li[data-domain="${domain}"]`);
        const spark = li ? li.querySelector("canvas.sparkline") : null;
        if (spark) {
          const lastLoads = logs
            .filter((r) => r.domain === domain)
            .map((r) => r.loadTime)
            .filter((v) => typeof v === "number" && !isNaN(v));
          drawSparkline(spark, lastLoads);
        }
      });
    }
  );
}

function updateTotalStats() {
  chrome.storage.local.get(["tracked", "logs", "currentLoads"], (data) => {
    const tracked = data.tracked || [];
    const logs = data.logs || [];
    const currentLoads = data.currentLoads || {};
    const now = Date.now();

    // If no tracked sites, hide the total stats
    const totalStatsElement = document.getElementById("totalStats");
    if (tracked.length === 0) {
      totalStatsElement.style.display = "none";
      return;
    }

    // Aggregate totals for all tracked sites
    const totals = { h: 0, d: 0, w: 0, m: 0, y: 0 };
    tracked.forEach((domain) => {
      totals.h += getTimeInWindow(logs, domain, "h", currentLoads[domain]);
      totals.d += getTimeInWindow(logs, domain, "d", currentLoads[domain]);
      totals.w += getTimeInWindow(logs, domain, "w", currentLoads[domain]);
      totals.m += getTimeInWindow(logs, domain, "m", currentLoads[domain]);
      totals.y += getTimeInWindow(logs, domain, "y", currentLoads[domain]);

      // Include live duration for all tabs of the domain
      const domainLoads = currentLoads[domain];
      if (domainLoads) {
        Object.values(domainLoads).forEach((startTime) => {
          if (typeof startTime === "number") {
            const liveDuration = now - startTime;
            totals.h += liveDuration;
            totals.d += liveDuration;
            totals.w += liveDuration;
            totals.m += liveDuration;
            totals.y += liveDuration;
          }
        });
      }
    });

    // Format the totals
    const stats = [
      `H ${formatDuration(totals.h)}`,
      `D ${formatDuration(totals.d)}`,
      `W ${formatDuration(totals.w)}`,
      `M ${formatDuration(totals.m)}`,
      `Y ${formatDuration(totals.y)}`,
    ].join(" | ");

    // Update the total stats element
    totalStatsElement.textContent = stats;
    totalStatsElement.style.display = "block";
  });
}

//
// Kick off a continuous animation‐frame loop to see live counts.
// Now it only updates the stats, not the entire list.
//
function loop() {
  if (!running) return;
  updateStats();
  updateTotalStats(); // Update the aggregated stats
  requestAnimationFrame(loop);
}

document.addEventListener("DOMContentLoaded", () => {
  renderSiteList();
  loop();
});

window.addEventListener("unload", () => {
  running = false;
});

//
// "+" button: add the current domain to `tracked` but don't start counting yet
//
addBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) return;

    const domain = new URL(tabs[0].url).hostname;
    chrome.storage.local.get(["tracked", "logs"], (data) => {
      const tracked = data.tracked || [];
      const logs = data.logs || [];

      // Only add if not already tracking
      if (!tracked.includes(domain)) {
        tracked.push(domain);
      } else {
        console.log("Domain already being tracked");
      }

      // Prune old logs
      const cutoff = Date.now() - 365 * 24 * 60 * 60 * 1000; // 1 year
      const pruned = logs.filter((r) => r.timestamp >= cutoff);

      chrome.storage.local.set({ tracked, logs: pruned }, () => {
        // Dynamically execute content.js to scrape the favicon
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            files: ["content.js"],
          },
          (results) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Error executing content script:",
                chrome.runtime.lastError.message
              );
            } else {
              console.log("Content script executed successfully:", results);
            }
          }
        );
      });
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "favicon-scraped") {
    console.log(`Favicon scraping complete for domain: ${message.domain}`);
    renderSiteList(); // Re-render the site list to include the new favicon
  }
});
