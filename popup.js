// popup.js

const siteList = document.getElementById('siteList');
const addBtn = document.getElementById('addBtn');

// Load and display stats
async function refresh() {
    const { logs = [] } = await chrome.storage.local.get('logs');
    const now = Date.now();
    // Group by domain
    const byDomain = logs.reduce((acc, r) => {
        if (!acc[r.domain]) acc[r.domain] = [];
        acc[r.domain].push(r);
        return acc;
    }, {});

    siteList.innerHTML = '';
    for (const [domain, records] of Object.entries(byDomain)) {
        const iconUrl = `chrome://favicon/?page_url=https://${domain}`; // favicon API 
        // Time windows in ms
        const windows = {
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000,
            w: 7 * 24 * 60 * 60 * 1000,
            m: 30 * 24 * 60 * 60 * 1000
        };
        const totals = Object.fromEntries(
            Object.entries(windows).map(([k, span]) => [
                k,
                records.filter(r => now - r.timestamp <= span)
                    .reduce((sum, r) => sum + r.loadTime, 0).toFixed(0)
            ])
        );

        const li = document.createElement('li');
        li.className = 'siteItem';
        li.innerHTML = `
      <img src="${iconUrl}">
      <span>${domain}</span>
      <div class="stats">
        H:${totals.h}ms<br>
        D:${totals.d}ms<br>
        W:${totals.w}ms<br>
        M:${totals.m}ms
      </div>`;
        siteList.appendChild(li);
    }
}

// Add current tab’s domain to tracking
addBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const domain = new URL(tab.url).hostname;
    // Just ensure domain appears by forcing a dummy log
    chrome.storage.local.get({ logs: [] }, ({ logs }) => {
        logs.push({ domain, timestamp: Date.now(), loadTime: 0 });
        chrome.storage.local.set({ logs });
        refresh();
    });
});

refresh();
