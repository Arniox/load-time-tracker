// popup.js
const siteList = document.getElementById('siteList');
const addBtn = document.getElementById('addBtn');
let running = true;

// Format a millisecond total into ms, s, m, or h
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

function updateUI() {
    chrome.storage.local.get(['tracked', 'logs', 'icons', 'currentLoads'], items => {
        const tracked = items.tracked || [];
        const logs = items.logs || [];
        const icons = items.icons || {};
        const currentLoads = items.currentLoads || {};
        const now = Date.now();

        siteList.innerHTML = '';

        tracked.forEach(domain => {
            // get past logs
            const recs = logs.filter(r => r.domain === domain);

            // time windows
            const windows = {
                h: 60 * 60 * 1000,
                d: 24 * 60 * 60 * 1000,
                w: 7 * 24 * 60 * 60 * 1000,
                m: 30 * 24 * 60 * 60 * 1000
            };

            // sum logs + in-flight
            const totals = {};
            for (const [k, span] of Object.entries(windows)) {
                let sum = recs
                    .filter(r => now - r.timestamp <= span)
                    .reduce((a, r) => a + (r.loadTime || 0), 0);

                // if there’s an in-flight start and it’s within this window
                const start = currentLoads[domain];
                if (typeof start === 'number' && (now - start) <= span) {
                    sum += (now - start);
                }
                totals[k] = sum;
            }

            // stats line
            const stats = [
                `H ${formatDuration(totals.h)}`,
                `D ${formatDuration(totals.d)}`,
                `W ${formatDuration(totals.w)}`,
                `M ${formatDuration(totals.m)}`
            ].join(' | ');

            // build list item
            const li = document.createElement('li');

            // favicon with fallbacks
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

            // text block
            const info = document.createElement('div');
            info.className = 'info';
            info.innerHTML = `
        <span class="domain">${domain}</span>
        <span class="stats">${stats}</span>
      `;

            // remove button: clears tracked, logs & currentLoads
            const rm = document.createElement('button');
            rm.className = 'removeBtn';
            rm.textContent = '×';
            rm.title = 'Stop tracking';
            rm.addEventListener('click', () => {
                chrome.storage.local.get(['tracked', 'logs', 'currentLoads'], data => {
                    const nt = (data.tracked || []).filter(d => d !== domain);
                    const nl = (data.logs || []).filter(r => r.domain !== domain);
                    const nc = Object.assign({}, data.currentLoads || {});
                    delete nc[domain];
                    chrome.storage.local.set({
                        tracked: nt,
                        logs: nl,
                        currentLoads: nc
                    }, updateUI);
                });
            });

            li.append(img, info, rm);
            siteList.append(li);
        });
    });
}

// live animation loop
function loop() {
    if (!running) return;
    updateUI();
    requestAnimationFrame(loop);
}

// start & stop
document.addEventListener('DOMContentLoaded', () => loop());
window.addEventListener('unload', () => { running = false; });

// “+” button: adds to tracked & primes a zero‐entry
addBtn.addEventListener('click', () => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (!tabs[0]?.url) return;
        const domain = new URL(tabs[0].url).hostname;
        chrome.storage.local.get(['tracked', 'logs', 'currentLoads'], data => {
            const tr = data.tracked || [];
            const lg = data.logs || [];
            const cl = data.currentLoads || {};

            if (!tr.includes(domain)) {
                tr.push(domain);
                cl[domain] = Date.now();            // start counting immediately
                lg.push({ domain, timestamp: Date.now(), loadTime: 0 });
            }

            const prunedLogs = lg.filter(r => r.timestamp >= cutoff);
            chrome.storage.local.set({
                tracked: tr,
                logs: prunedLogs,
                currentLoads: cl
            }, updateUI);
        });
    });
});
