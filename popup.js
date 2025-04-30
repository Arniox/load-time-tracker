// popup.js

const siteList = document.getElementById('siteList');
const addBtn = document.getElementById('addBtn');

let running = true;

// duration formatter
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

// draw UI
async function draw() {
    const { tracked = [], logs = [] } = await chrome.storage.local.get(['tracked', 'logs']);
    const now = Date.now();

    siteList.innerHTML = '';

    // Show every tracked domain, even if no logs yet
    for (const domain of tracked) {
        // filter its logs
        const records = logs.filter(r => r.domain === domain);

        // compute totals
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
        const stats = [
            `H ${formatDuration(totals.h)}`,
            `D ${formatDuration(totals.d)}`,
            `W ${formatDuration(totals.w)}`,
            `M ${formatDuration(totals.m)}`
        ].join(' | ');

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

        // text info
        const info = document.createElement('div');
        info.className = 'info';
        info.innerHTML = `
            <span class="domain">${domain}</span>
            <span class="stats">${stats}</span>`;

        // remove button
        const rm = document.createElement('button');
        rm.className = 'removeBtn';
        rm.textContent = '×';
        rm.title = 'Stop tracking';
        rm.addEventListener('click', async () => {
            const { tracked = [], logs = [] } = await chrome.storage.local.get(['tracked', 'logs']);
            const newTracked = tracked.filter(d => d !== domain);
            const newLogs = logs.filter(r => r.domain !== domain);
            await chrome.storage.local.set({ tracked: newTracked, logs: newLogs });
            // immediate UI update
            draw();
        });

        li.append(img, info, rm);
        siteList.append(li);
    }
}

// animation loop for live updates
function loop() {
    if (!running) return;
    draw();
    requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', () => {
    loop();
});

// stop loop on unload
window.addEventListener('unload', () => {
    running = false;
});

// add current site
addBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = new URL(tab.url).hostname;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const { tracked = [], logs = [] } = await chrome.storage.local.get(['tracked', 'logs']);
    if (!tracked.includes(domain)) {
        tracked.push(domain);
        logs.push({ domain, timestamp: Date.now(), loadTime: 0 });
        // prune old logs
        const pruned = logs.filter(r => r.timestamp >= cutoff);
        await chrome.storage.local.set({ tracked, logs: pruned });
    }
});
