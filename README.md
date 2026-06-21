# Coffee Roaster Command Center

A small static web app for reviewing wholesale coffee roaster inquiries, sales performance, and operator triage workflow.

## Run locally

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/dashboard.html
```

## Pages

* `dashboard.html`: main dashboard with inquiry, revenue, region, channel, and product views.
* `triage.html`: inquiry triage workflow for reviewing and acting on inbound wholesale inquiries.

## Data

The app reads local mock data from:

```text
data/inquiries.json
data/sales.json
data/accounts.json
```

## Notes

This project is built with plain HTML, CSS, and JavaScript. No build step, framework, or package install is required.
