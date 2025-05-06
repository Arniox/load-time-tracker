# Load Time Tracker



**Version 1.0.1** • *2025-05-06*

> Measure, visualize & optimize your page-load performance—live, right from your browser toolbar.

---

## 📖 Overview

Load Time Tracker is a lightweight Chrome extension crafted for developers and QA teams to monitor real-world page-load durations. With one click, you can track any site, see a live badge timer as your page loads, and review historical aggregates over the last hour, day, week, and month. All data is stored locally—no external servers or third-party analytics.

---

## ✨ Key Features

- **One-click tracking**: Add the current domain to your watch list with the “＋” button in the popup.
- **Live badge timer**: See a millisecond-precision timer counting up on your extension icon while the page loads.
- **Accurate final measurements**: Captures precise load durations via the Performance Timing API, with a timestamp fallback.
- **Sliding-window aggregates**: Automatically compute total load time over the last hour, day, week, and month; windows reset at each rollover.
- **Per-site insights**: In the popup, view for each domain:
  - **Now**: live or most recent load duration
  - **Avg**: average load time across recorded loads
  - **Reloads**: total number of logged load events
- **Global totals**: Combined H/D/W/M summary for all monitored domains.
- **Favicon scraping**: Displays each site’s real favicon (harvested from `<link rel="icon">`).
- **Automatic pruning**: Logs older than 30 days are cleared to keep storage usage minimal.
- **Privacy-first storage**: Everything lives in `chrome.storage.local` under your profile.

---

## 🚀 Installation

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
   - **Now**: current in-flight or last load duration
   - **H / D / W / M**: total load time over sliding windows
   - **Avg** and **Reloads** counts per domain
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
