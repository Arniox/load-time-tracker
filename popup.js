// popup.js

const siteList = document.getElementById('siteList');
const addBtn = document.getElementById('addBtn');

let running = true;

// Format ms into ms/s/m/h per your rules
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    const s = ms / 1000;
    if (ms < 10000) return `${s.toFixed(2)}s`;
    if (ms < 60000) return `${Math.round(s)}s`;
    const m = ms / 60000;
    if (ms < 3600000) return `${Math.round(m)}m`;
    const h = ms / 3600000;
    return `${Math.round(h)}h`;
}

// Draw once
async function draw() {
    const { logs = [] } = await chrome.storage.local.get('logs');
    const now = Date.now();

    // Group logs by domain
    const byDomain = logs.reduce((acc, r) => {
        (acc[r.domain] ||= []).push(r);
        return acc;
    }, {});

    siteList.innerHTML = '';

    for (const [domain, records] of Object.entries(byDomain)) {
        // compute sums
        const windows = {
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            w: 7 * 24 * 60 * 60 * 1000,
            m: 30 * 24 * 60 * 60 * 1000
        };
        const totals = Object.fromEntries(
            Object.entries(windows).map(([k, span]) => {
                const sum = records
                    .filter(r => now - r.timestamp <= span)
                    .reduce((sum, r) => sum + r.loadTime, 0);
                return [k, sum];
            })
        );
        const stats = `H ${formatDuration(totals.h)} | D ${formatDuration(totals.d)} | W ${formatDuration(totals.w)} | M ${formatDuration(totals.m)}`;

        // build LI
        const li = document.createElement('li');

        // favicon fallback chain
        const img = document.createElement('img');
        img.className = 'favicon';
        let step = 0;
        const fallbacks = [
            () => chrome.storage.local.get('icons').then(({ icons = {} }) => icons[domain] || null),
            () => `chrome://favicon/?page_url=https://${domain}`,
            () => `chrome://favicon/?page_url=http://${domain}`,
            () => `https://${domain}/favicon.ico`,
            () => `http://${domain}/favicon.ico`
        ];
        img.onerror = () => {
            step++;
            const next = fallbacks[step]?.();
            if (next) Promise.resolve(next).then(src => img.src = src);
        };
        Promise.resolve(fallbacks[step]()).then(src => img.src = src);

        // info
        const info = document.createElement('div');
        info.className = 'info';
        info.innerHTML = `
      <span class="domain">${domain}</span>
      <span class="stats">${stats}</span>
    `;

        // remove
        const rm = document.createElement('button');
        rm.className = 'removeBtn';
        rm.textContent = '×';
        rm.title = 'Stop tracking';
        rm.addEventListener('click', () => {
            chrome.storage.local.get({ logs: [] }, ({ logs }) => {
                const keep = logs.filter(r => r.domain !== domain);
                chrome.storage.local.set({ logs: keep });
            });
        });

        li.append(img, info, rm);
        siteList.append(li);
    }
}

// animation loop
function loop() {
    if (!running) return;
    draw();
    requestAnimationFrame(loop);
}

// start the loop when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    loop();
});

// stop the loop if the popup unloads (cleanup)
window.addEventListener('unload', () => {
    running = false;
});

// “+” button unchanged
addBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = new URL(tab.url).hostname;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    chrome.storage.local.get({ logs: [] }, ({ logs }) => {
        logs.push({ domain, timestamp: Date.now(), loadTime: 0 });
        const pruned = logs.filter(r => r.timestamp >= cutoff);
        chrome.storage.local.set({ logs: pruned });
    });
});