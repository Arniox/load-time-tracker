// popup.js

const siteList = document.getElementById('siteList');
const addBtn = document.getElementById('addBtn');
let running = true;

//
// Convert a millisecond total into your desired unit format
//
function formatDuration(ms) {
    if (typeof ms !== 'number' || isNaN(ms)) return '0ms';
    if (ms < 1000) return `${ms}ms`;
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
function getTimeInWindow(logs, domain, windowType, currentValue) {
    const now = Date.now();

    // Get current window values
    const currentHour = Math.floor(now / (60 * 60 * 1000));
    const currentDay = Math.floor(now / (24 * 60 * 60 * 1000));
    const currentWeek = Math.floor(now / (7 * 24 * 60 * 60 * 1000));
    const currentMonth = Math.floor(now / (30 * 24 * 60 * 60 * 1000));

    // Filter logs for the specific domain and time window
    return logs
        .filter(r => {
            if (r.domain !== domain) return false;

            switch (windowType) {
                case 'h':
                    return r.hourWindow === currentHour;
                case 'd':
                    return r.dayWindow === currentDay;
                case 'w':
                    return r.weekWindow === currentWeek;
                case 'm':
                    return r.monthWindow === currentMonth;
                default:
                    // Fallback to traditional time-based filtering
                    const windowMaps = {
                        h: 60 * 60 * 1000,
                        d: 24 * 60 * 60 * 1000,
                        w: 7 * 24 * 60 * 60 * 1000,
                        m: 30 * 24 * 60 * 60 * 1000
                    };
                    return (now - r.timestamp) <= windowMaps[windowType];
            }
        })
        .reduce((sum, r) => sum + (r.loadTime || 0), 0);
}

// Function to properly remove a site from tracking
function removeSite(domain) {
    console.log(`Removing site: ${domain}`); // Debug log

    chrome.storage.local.get(
        ['tracked', 'logs', 'currentLoads', 'icons'],
        data => {
            console.log('Before removal:', data); // Debug log

            // Filter out the domain from the tracked list
            const tracked = (data.tracked || []).filter(x => x !== domain);

            // Filter out all logs for this domain
            const logs = (data.logs || []).filter(r => r.domain !== domain);

            // Remove any in-flight loads
            const currentLoads = { ...(data.currentLoads || {}) };
            delete currentLoads[domain];

            // Remove icon if stored
            const icons = { ...(data.icons || {}) };
            delete icons[domain];

            // Debug data after changes
            console.log('After removal preparation:', {
                tracked,
                logCount: logs.length,
                currentLoads,
                icons
            });

            // Update storage with all the cleaned data
            chrome.storage.local.set(
                { tracked, logs, currentLoads, icons },
                () => {
                    console.log('Storage updated after removal'); // Debug log
                    updateUI(); // Make sure UI is updated after storage changes
                }
            );
        }
    );
}

//
// Rebuild the popup list—combining saved logs + any in-flight load.
//
function updateUI() {
    chrome.storage.local.get(
        ['tracked', 'logs', 'icons', 'currentLoads'],
        data => {
            const tracked = data.tracked || [];
            const logs = data.logs || [];
            const icons = data.icons || {};
            const currentLoads = data.currentLoads || {};
            const now = Date.now();

            siteList.innerHTML = '';

            tracked.forEach(domain => {
                // Calculate aggregates for each time window
                const totals = {
                    h: getTimeInWindow(logs, domain, 'h', currentLoads[domain]),
                    d: getTimeInWindow(logs, domain, 'd', currentLoads[domain]),
                    w: getTimeInWindow(logs, domain, 'w', currentLoads[domain]),
                    m: getTimeInWindow(logs, domain, 'm', currentLoads[domain])
                };

                // If there's a start time still open, include it in the totals
                const start = currentLoads[domain];
                if (typeof start === 'number') {
                    const liveDuration = now - start;
                    totals.h += liveDuration;
                    totals.d += liveDuration;
                    totals.w += liveDuration;
                    totals.m += liveDuration;
                }

                // Build the stats line
                const stats = [
                    `H ${formatDuration(totals.h)}`,
                    `D ${formatDuration(totals.d)}`,
                    `W ${formatDuration(totals.w)}`,
                    `M ${formatDuration(totals.m)}`
                ].join(' | ');

                // Create list item
                const li = document.createElement('li');

                // Favicon with multiple fallbacks
                const img = document.createElement('img');
                img.className = 'favicon';
                let step = 0;
                const fallbacks = [
                    icons[domain] || null,
                    `chrome://favicon/?page_url=https://${domain}`,
                    `chrome://favicon/?page_url=http://${domain}`,
                    `https://${domain}/favicon.ico`,
                    `http://${domain}/favicon.ico`
                ];
                img.onerror = () => {
                    step++;
                    if (fallbacks[step]) img.src = fallbacks[step];
                };
                img.src = fallbacks.find(src => !!src) || '';

                // Domain + stats block
                const info = document.createElement('div');
                info.className = 'info';
                info.innerHTML = `
                    <span class="domain">${domain}</span>
                    <span class="stats">${stats}</span>
                `;

                // "×" remove button - Now creates a standalone function for event handler
                const rm = document.createElement('button');
                rm.className = 'removeBtn';
                rm.textContent = '×';
                rm.title = 'Stop tracking';

                // Using a named function for better reliability
                function handleRemoveClick(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Remove button clicked for:', domain); // Debug log
                    removeSite(domain);
                    return false;
                }

                rm.addEventListener('click', handleRemoveClick);

                li.append(img, info, rm);
                siteList.append(li);
            });
        }
    );
}

//
// Kick off a continuous animation‐frame loop so you see live counts.
// It'll also pick up completed loads the moment they're written.
//
function loop() {
    if (!running) return;
    updateUI();
    requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', () => {
    loop();
});

window.addEventListener('unload', () => {
    running = false;
});

//
// "+" button: add the current domain to `tracked` but don't start counting yet
//
addBtn.addEventListener('click', () => {
    chrome.tabs.query(
        { active: true, currentWindow: true },
        tabs => {
            if (!tabs[0]?.url) {
                return;
            }

            const domain = new URL(tabs[0].url).hostname;
            chrome.storage.local.get(
                ['tracked', 'logs'],
                data => {
                    const tracked = data.tracked || [];
                    const logs = data.logs || [];

                    // Only add if not already tracking
                    if (!tracked.includes(domain)) {
                        tracked.push(domain);
                        console.log('Domain added to tracked sites');
                    } else {
                        console.log('Domain already being tracked');
                    }

                    // Prune old logs
                    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
                    const pruned = logs.filter(r => r.timestamp >= cutoff);

                    chrome.storage.local.set(
                        { tracked, logs: pruned },
                        () => {
                            console.log('Storage updated after adding site');
                            updateUI();
                        }
                    );
                }
            );
        }
    );
});