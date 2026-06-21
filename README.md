# Coffee Roaster Command Center

A small static web app for reviewing wholesale coffee roaster inquiries, sales performance, and the operator triage workflow.

## Live Demo

Access the project through GitHub Pages:

```text
https://weslleysrodrigues.github.io/os-challenge-weslley/dashboard.html
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

## Run locally, optional

This project does not require a build step or package install. To run it locally, use:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/dashboard.html
```

## Tech

Built with plain HTML, CSS, and JavaScript. No framework or build process is required.
