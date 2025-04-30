// popup.js

const siteList = document.getElementById('siteList');
const addBtn = document.getElementById('addBtn');

let rafId = null;

// Convert a millisecond value into the desired display format
function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;                     // under 1s → ms
    const secs = ms / 1000;
    if (ms < 10000) return `${secs.toFixed(2)}s`;        // 1s–10s → 2-dec places
    if (ms < 60000) return `${Math.round(secs)}s`;       // 10s–60s → whole seconds
    const mins = ms / 60000;
    if (ms < 3600000) return `${Math.round(mins)}m`;       // 1m–60m → whole minutes
    const hrs = ms / 3600000;
    return `${Math.round(hrs)}h`;         // above 1h → whole hours
}

async function refresh() {
    const { logs = [] } = await chrome.storage.local.get('logs');
    const now = Date.now();

    // Group logs by domain
    const byDomain = logs.reduce((acc, r) => {
        (acc[r.domain] ||= []).push(r);
        return acc;
    }, {});

    siteList.innerHTML = '';

    for (const [domain, records] of Object.entries(byDomain)) {
        // Calculate totals for each window
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
                    .reduce((a, r) => a + r.loadTime, 0);
                return [k, sum];
            })
        );

        // Build the stats line with formatted units
        const statsText = [
            `H ${formatDuration(totals.h)}`,
            `D ${formatDuration(totals.d)}`,
            `W ${formatDuration(totals.w)}`,
            `M ${formatDuration(totals.m)}`
        ].join(' | ');

        // Create the LI
        const li = document.createElement('li');

        // Favicon element (same fallback chain as before)
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
        // Kick off first favicon attempt (async if needed)
        Promise.resolve(fallbacks[step]()).then(src => { if (src) img.src = src; });

        // Domain + stats container
        const info = document.createElement('div');
        info.className = 'info';
        info.innerHTML = `
      <span class="domain">${domain}</span>
      <span class="stats">${statsText}</span>
    `;

        // Remove‐tracking button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'removeBtn';
        removeBtn.textContent = '×';
        removeBtn.title = 'Stop tracking';
        removeBtn.addEventListener('click', () => {
            chrome.storage.local.get({ logs: [] }, ({ logs }) => {
                const filtered = logs.filter(r => r.domain !== domain);
                chrome.storage.local.set({ logs: filtered }, refresh);
            });
        });

        li.append(img, info, removeBtn);
        siteList.append(li);
    }
}

// When you click “+” to add the current site
addBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = new URL(tab.url).hostname;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    chrome.storage.local.get({ logs: [] }, ({ logs }) => {
        logs.push({ domain, timestamp: Date.now(), loadTime: 0 });
        const pruned = logs.filter(r => r.timestamp >= cutoff);
        chrome.storage.local.set({ logs: pruned }, () => {
            // Immediately refresh to show the new domain
            refresh();
        });
    });
});

// Listen for any changes to logs and refresh next frame
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.logs) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(refresh);
    }
});

// Initial paint
refresh();
