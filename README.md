# Load Time Tracker

**Version 1.4.2** • _September 24, 2025_

> Measure, visualize & optimize your page-load performance—live, right from your browser toolbar.

---

## 📖 Overview

Load Time Tracker is a lightweight Chrome extension crafted for developers and QA teams to monitor real-world page-load durations. With one click, you can track any site, see a live badge timer as your page loads, and review historical aggregates over the last hour, day, week, month, and year. All data is stored locally—no external servers or third-party analytics.

---

## ✨ Key Features

- **One-click tracking**: Add the current domain to your watch list with the “＋” button in the popup.
- **Live badge timer**: See a millisecond-precision timer counting up on your extension icon while the page loads.
- **Accurate final measurements**: Captures precise load durations via the Performance Timing API, with a timestamp fallback.
- **Sliding-window aggregates**: Automatically compute total load time over the last hour, day, week, month, and **year**; windows reset at each rollover.
- **Per-site insights**: In the popup, view for each domain:
  - **Now**: live or most recent load duration (aggregates across multiple tabs for the same domain).
  - **Avg**: average load time across recorded loads.
  - **H / D / W / M / Y**: total load time over sliding windows (Hour, Day, Week, Month, Year).
  - **Sparkline**: a compact trendline of the last X loads (right-aligned, with subtle left fade).
- **Global totals**: Combined H/D/W/M/**Y** summary for all monitored domains.
- **Favicon scraping**: Displays each site’s real favicon (harvested from `<link rel="icon">`).
- **Automatic pruning**: Logs older than 1 year are cleared to keep storage usage minimal.
- **Robust multi-tab handling**:
  - Tracks multiple tabs for the same domain independently.
  - Automatically stops tracking when the last tab for a domain is closed.
- **Dead tab cleanup**: Automatically clears stuck counters for tabs that no longer exist.
- **Privacy-first storage**: Everything lives in `chrome.storage.local` under your profile.

### New in 1.4.1

- **Richer secondary stats (popup & overlay)**: Now shows “Now • Last • Avg • Reloads” for each domain. “Now” mirrors the live badge and aggregates in-flight loads across multiple tabs for the same domain. “Reloads” is the total number of recorded loads and is now displayed with thousands separators for readability.
- **Consistency polish**: The popup and on-page overlay now present identical secondary metrics and formatting so you see the same story wherever you look.

### New in 1.4.0

- **On-page overlay chip**: Optional, per-domain overlay that shows “Last • Avg” while you browse. Toggle per domain in the popup; use the global overlay button to mass-toggle all domains on/off.
- **Anomaly alerts (optional)**: Local-only notifications when a load deviates from your 14‑day baseline (percent and standard-deviation thresholds with cooldown).
- **Popup sparklines**: Each domain gets a trendline of its most recent loads (right-aligned; dynamic spacing; subtle left fade). The secondary stats now show “Last • Avg” to match the overlay.

---

## 🚀 Installation

You can install Load Time Tracker in two ways:

### **Option 1: Install from the Chrome Web Store**

1. Visit the [Chrome Web Store page](https://chromewebstore.google.com/detail/fiphipojeggbbkakmeecjdnombobihcc?utm_source=item-share-cb).
2. Click **Add to Chrome**.
3. The Load Time Tracker icon will appear in your toolbar—click to open the popup and start tracking.

### **Option 2: Manual Installation**

1. **Download** the latest release ZIP (`application.zip`) from this repository’s [Releases](https://github.com/Arniox/load-time-tracker/releases).
2. **Unzip** the file to a local folder.
3. In Chrome, navigate to **chrome://extensions** and enable **Developer mode**.
4. Click **Load unpacked** and select the `application/` folder.
5. The Load Time Tracker icon will appear in your toolbar—click to open the popup and start tracking.

---

## 📂 Directory Structure

```
YourRepo/
├── application/         # Chrome extension source files
│   ├── background.js    # Service worker: navigation event handlers & logging
│   ├── content.js       # Content script: favicon scraping
│   ├── manifest.json    # Extension manifest (MV3)
│   ├── popup.html       # Popup UI markup
│   ├── popup.css        # Popup styles
│   ├── popup.js         # Popup logic: live loop & UI rendering
│   ├── icon-48.png      # Toolbar icon
│   └── icon-128.png     # Store/install icon
├── docs/                # GitHub Pages (privacy policy)
│   └── privacy.html     # Hosted privacy policy
├── application.zip      # Packaged extension for releases
└── README.md            # This documentation
```

---

## ⚙️ Usage

1. Click the toolbar icon and press **＋** to add the current site’s domain.
2. **Refresh** the page—observe the live badge timer increment in real time.
3. Open the popup to see:

- **Now**: current in-flight or last load duration (aggregates across all tabs for the same domain).
- **H / D / W / M / Y**: total load time over sliding windows.
- **Secondary stats**: “Now • Last • Avg • Reloads”, with Reloads formatted using thousands separators.

4. Remove a site by clicking the **×** next to its entry—this deletes all associated logs.

---

## 🛠 Development

1. Clone the repository:
   ```bash
   git clone https://github.com/YourUser/YourRepo.git
   cd YourRepo/application
   ```
2. Open Chrome’s **Extensions** page (`chrome://extensions`) in **Developer mode**.
3. Click **Load unpacked** and select this directory.
4. Modify source files as needed, then click **Reload** under the extension entry.
5. Use the browser DevTools console under **Service Worker** (background.js) or **Popup** to debug.

---

## 🛡 Privacy & Security

- **Local-only storage**: All timing data and favicons are stored in `chrome.storage.local`.
- **No external sharing**: No data is transmitted beyond your browser.
- **Minimal permissions**:
  - `storage`
  - `webNavigation`
  - `activeTab`
  - `scripting`
  - Host access to `<all_urls>` for pages you choose to track.

See our full [Privacy Policy](https://arniox.github.io/load-time-tracker/privacy.html) for details.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Please open an issue or submit a pull request on [GitHub](https://github.com/Arniox/load-time-tracker).

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

© 2025 Nikkolas Diehl. All rights reserved.
