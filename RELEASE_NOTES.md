# Load Time Tracker – Release Notes

## 1.4.1 — September 22, 2025

Hotfix release focused on UI consistency and clarity.

- Popup and on-page overlay now show identical secondary stats: “Now • Last • Avg • Reloads”.
  - “Now” mirrors the live badge timer and aggregates simultaneous in-flight loads across multiple tabs for the same domain, falling back to the most recent completed load when idle.
  - “Last” is the most recent completed load.
  - “Avg” is the average across recorded loads for the domain.
  - “Reloads” displays the count of recorded loads, now formatted with thousands separators for readability.
- No changes to permissions or storage schema.
- Internal: minor UI polish and formatting improvements.

## 1.4.0 — September 22, 2025

- On-page overlay chip (per-domain toggleable; global mass-toggle).
- Anomaly alerts (optional) using a 14‑day baseline with percentage and standard deviation thresholds and cooldown.
- Popup sparklines for recent loads (right-aligned, dynamic spacing, left fade), plus a midline baseline for better empty-state appearance.
- Yearly window added to aggregates (H/D/W/M/Y) and one-year retention.

---

For installation and usage details, see the README.
