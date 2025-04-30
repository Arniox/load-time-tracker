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
                // Gather only this domain’s past logs
                const recs = logs.filter(r => r.domain === domain);

                // Define your sliding windows
                const windows = {
                    h: 60 * 60 * 1000,
                    d: 24 * 60 * 60 * 1000,
                    w: 7 * 24 * 60 * 60 * 1000,
                    m: 30 * 24 * 60 * 60 * 1000
                };

                // Sum each window + add live delta if in-flight
                const totals = {};
                for (const [k, span] of Object.entries(windows)) {
                    let sum = recs
                        .filter(r => now - r.timestamp <= span)
                        .reduce((a, r) => a + (r.loadTime || 0), 0);

                    // If there’s a start time still open, include it
                    const start = currentLoads[domain];
                    if (typeof start === 'number' && (now - start) <= span) {
                        sum += (now - start);
                    }
                    totals[k] = sum;
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

                // “×” remove button
                const rm = document.createElement('button');
                rm.className = 'removeBtn';
                rm.textContent = '×';
                rm.title = 'Stop tracking';
                rm.addEventListener('click', () => {
                    chrome.storage.local.get(
                        ['tracked', 'logs', 'currentLoads'],
                        d => {
                            const t = (d.tracked || []).filter(x => x !== domain);
                            const l = (d.logs || []).filter(r => r.domain !== domain);
                            const c = { ...(d.currentLoads || {}) };
                            delete c[domain];
                            chrome.storage.local.set(
                                { tracked: t, logs: l, currentLoads: c },
                                updateUI
                            );
                        }
                    );
                });

                li.append(img, info, rm);
                siteList.append(li);
            });
        }
    );
}

//
// Kick off a continuous animation‐frame loop so you see live counts.
// It’ll also pick up completed loads the moment they’re written.
//
function loop() {
    if (!running) return;
    updateUI();
    requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', () => loop());
window.addEventListener('unload', () => { running = false; });

//
// “+” button: add the current domain to `tracked` and prime its
// in-flight start so you see the live count immediately.
//
addBtn.addEventListener('click', () => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    chrome.tabs.query(
        { active: true, currentWindow: true },
        tabs => {
            if (!tabs[0]?.url) return;
            const domain = new URL(tabs[0].url).hostname;
            chrome.storage.local.get(
                ['tracked', 'logs', 'currentLoads'],
                data => {
                    const t = data.tracked || [];
                    const l = data.logs || [];
                    const c = data.currentLoads || {};

                    if (!t.includes(domain)) {
                        t.push(domain);
                        c[domain] = Date.now();       // start live count now
                    }
                    // prune old logs
                    const pruned = l.filter(r => r.timestamp >= cutoff);

                    chrome.storage.local.set(
                        { tracked: t, logs: pruned, currentLoads: c },
                        updateUI
                    );
                }
            );
        }
    );
});
