// popup.js
const siteList = document.getElementById('siteList');
const addBtn = document.getElementById('addBtn');

let running = true;

// 1. Format ms → ms, s, m, or h with your thresholds
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

// 2. Read storage and rebuild the list
function updateUI() {
    chrome.storage.local.get(['tracked', 'logs', 'icons'], items => {
        const tracked = items.tracked || [];
        const logs = items.logs || [];
        const icons = items.icons || {};
        const now = Date.now();

        siteList.innerHTML = '';

        tracked.forEach(domain => {
            // Gather only this domain's records
            const records = logs.filter(r => r.domain === domain);

            // Compute totals
            const windows = {
                h: 60 * 60 * 1000,
                d: 24 * 60 * 60 * 1000,
                w: 7 * 24 * 60 * 60 * 1000,
                m: 30 * 24 * 60 * 60 * 1000
            };
            const totals = {};
            for (const [k, span] of Object.entries(windows)) {
                const sum = records
                    .filter(r => now - r.timestamp <= span)
                    .reduce((acc, r) => acc + (r.loadTime || 0), 0);
                totals[k] = sum;
            }
            const statsText = [
                `H ${formatDuration(totals.h)}`,
                `D ${formatDuration(totals.d)}`,
                `W ${formatDuration(totals.w)}`,
                `M ${formatDuration(totals.m)}`
            ].join(' | ');

            // Build the <li>
            const li = document.createElement('li');

            // Favicon fallback chain
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
                if (step < fallbacks.length && fallbacks[step]) {
                    img.src = fallbacks[step];
                }
            };
            // Kick off first valid src
            img.src = fallbacks.find(src => !!src) || '';

            // Text block
            const info = document.createElement('div');
            info.className = 'info';
            const domSpan = document.createElement('span');
            domSpan.className = 'domain';
            domSpan.textContent = domain;
            const statSpan = document.createElement('span');
            statSpan.className = 'stats';
            statSpan.textContent = statsText;
            info.append(domSpan, statSpan);

            // Remove button
            const rm = document.createElement('button');
            rm.className = 'removeBtn';
            rm.textContent = '×';
            rm.title = 'Stop tracking';
            rm.addEventListener('click', () => {
                chrome.storage.local.get(['tracked', 'logs'], data => {
                    const newTracked = (data.tracked || []).filter(d => d !== domain);
                    const newLogs = (data.logs || []).filter(r => r.domain !== domain);
                    chrome.storage.local.set({ tracked: newTracked, logs: newLogs }, updateUI);
                });
            });

            li.append(img, info, rm);
            siteList.append(li);
        });
    });
}

// 3. Live loop
function loop() {
    if (!running) return;
    updateUI();
    requestAnimationFrame(loop);
}
document.addEventListener('DOMContentLoaded', () => loop());
window.addEventListener('unload', () => { running = false; });

// 4. Add-button
addBtn.addEventListener('click', () => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (!tabs[0]?.url) return;
        const domain = new URL(tabs[0].url).hostname;
        chrome.storage.local.get(['tracked', 'logs'], data => {
            const tracked = data.tracked || [];
            const logs = data.logs || [];
            if (!tracked.includes(domain)) {
                tracked.push(domain);
                logs.push({ domain, timestamp: Date.now(), loadTime: 0 });
            }
            // prune old
            const pruned = logs.filter(r => r.timestamp >= cutoff);
            chrome.storage.local.set({ tracked, logs: pruned }, updateUI);
        });
    });
});