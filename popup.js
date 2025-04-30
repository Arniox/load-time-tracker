// popup.js
const siteList = document.getElementById('siteList');
const addBtn = document.getElementById('addBtn');

async function refresh() {
    const { logs = [], icons = {} } = await chrome.storage.local.get(['logs', 'icons']);
    const now = Date.now();

    const byDomain = logs.reduce((acc, r) => {
        (acc[r.domain] ||= []).push(r);
        return acc;
    }, {});

    siteList.innerHTML = '';

    for (const [domain, records] of Object.entries(byDomain)) {
        // compute totals (same as before)…
        const windows = { h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000, w: 7 * 24 * 60 * 60 * 1000, m: 30 * 24 * 60 * 60 * 1000 };
        const totals = Object.fromEntries(
            Object.entries(windows).map(([k, span]) => [
                k,
                records.filter(r => now - r.timestamp <= span)
                    .reduce((sum, r) => sum + r.loadTime, 0)
                    .toFixed(0)
            ])
        );
        const statsText = `H ${totals.h}ms | D ${totals.d}ms | W ${totals.w}ms | M ${totals.m}ms`;

        const li = document.createElement('li');

        // 1) Use harvested <link rel="icon"> if available
        const img = document.createElement('img');
        img.className = 'favicon';
        let step = 0;

        const fallbacks = [
            () => icons[domain] || null,
            () => `chrome://favicon/?page_url=https://${domain}`,
            () => `chrome://favicon/?page_url=http://${domain}`,
            () => `https://${domain}/favicon.ico`,
            () => `http://${domain}/favicon.ico`,
        ];

        const tryNext = () => {
            const src = fallbacks[step++]();
            if (src) img.src = src;
        };

        img.onerror = tryNext;
        tryNext();  // kick off first attempt

        // text info (same as before)…
        const info = document.createElement('div');
        info.className = 'info';
        const domainSpan = document.createElement('span');
        domainSpan.className = 'domain';
        domainSpan.textContent = domain;
        const statsDiv = document.createElement('div');
        statsDiv.className = 'stats';
        statsDiv.textContent = statsText;
        info.append(domainSpan, statsDiv);

        // remove button (same as before)…
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

// addBtn handler unchanged…
addBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = new URL(tab.url).hostname;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    chrome.storage.local.get({ logs: [] }, ({ logs }) => {
        logs.push({ domain, timestamp: Date.now(), loadTime: 0 });
        const pruned = logs.filter(r => r.timestamp >= cutoff);
        chrome.storage.local.set({ logs: pruned }, refresh);
    });
});

refresh();
