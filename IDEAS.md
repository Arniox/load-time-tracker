# Load Time Tracker – Ideas and Roadmap

This file tracks implemented and future ideas to extend the extension while staying true to its focus on practical load-time insights.

## 1.4.0 (in progress)

- Popup dashboard per domain:
  - Last, p50, p95
  - 7‑day trend sparkline
- Anomaly alerts:
  - Notify when a load is > X% above 14‑day baseline or > mean + 2σ
  - Cooldown to reduce noise
- On‑page overlay chip:
  - Toggle globally and per‑domain
  - Shows Last, avg, p95

## Next candidates

- Domain thresholds and badge colors (green/yellow/red) based on targets
- Release markers and before/after comparison within the popup
- Slowest pages per domain (path-level aggregation, opt‑in, privacy‑safe)
- Hour/day heatmap (avg/p95) and trend deltas vs last week
- Export CSV/JSON for selected domains/time ranges
- Weekly digest (top regressions, biggest improvements)
- Webhook/Slack notifications for anomalies or weekly summaries
- Retention controls and sampling for very active domains
- On‑page overlay keyboard shortcuts (toggle overlay, mark event)

## Notes

- Privacy first: no network egress; data local only; path tracking opt‑in; never store query params.
- Performance: prune by time and per‑domain caps; compact logs; sampling to avoid storage growth.
