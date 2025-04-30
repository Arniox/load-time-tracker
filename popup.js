const siteList = document.getElementById('siteList');
const addBtn = document.getElementById('addBtn');

// Re-render the list
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
        const iconUrl = `chrome://favicon/?page_url=https://${domain}`;

        // compute totals for each window
        const windows = {
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            w: 7 * 24 * 60 * 60 * 1000,
            m: 30 * 24 * 60 * 60 * 1000
        };
        const totals = Object.fromEntries(
            Object.entries(windows).map(([k, span]) => [
                k,
                records
                    .filter(r => now - r.timestamp <= span)
                    .reduce((sum, r) => sum + r.loadTime, 0)
                    .toFixed(0)
            ])
        );

        // build one-line stats
        const statsText = `H ${totals.h}ms | D ${totals.d}ms | W ${totals.w}ms | M ${totals.m}ms`;

        // create list item
        const li = document.createElement('li');
        li.innerHTML = `
      <div class="siteInfo">
        <img src="${iconUrl}" class="favicon">
        <span class="domain">${domain}</span>
      </div>
      <div class="stats">${statsText}</div>`;
        siteList.appendChild(li);
    }
}

// Add the current tab’s domain
addBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = new URL(tab.url).hostname;

    chrome.storage.local.get({ logs: [] }, ({ logs }) => {
        logs.push({ domain, timestamp: Date.now(), loadTime: 0 });
        // prune older than 30d
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const pruned = logs.filter(r => r.timestamp >= cutoff);
        chrome.storage.local.set({ logs: pruned }, refresh);
    });
});

refresh();
