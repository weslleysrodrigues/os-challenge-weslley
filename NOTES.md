# Notes

## What I prioritized

I prioritized a clear operator workflow over visual complexity. The dashboard focuses on the core business questions: how many inquiries came in, how many are qualified or closed, where demand is coming from, which channels are creating inquiries, which regions are driving revenue, and which products are selling best.

For the triage workflow, I prioritized speed and clarity for the operator. The inquiry queue shows only the fields needed to decide what to work on next: company, contact, email, priority, status, received date, requested volume, and inquiry notes. Additional details are kept inside the detail modal so the main queue stays easy to scan.

## What I deliberately cut

I removed conversion rate because the `closed` status was too vague. A closed inquiry could mean won, lost, or simply resolved, so showing it as a conversion metric could be misleading.

I also avoided adding too many optional features. Instead of building several half-finished extras, I focused on one strong bonus feature: a detail modal for each inquiry, plus filtering, search, and persistent contacted state.

## Triage prioritization rule

Each active inquiry is classified as Hot, Warm, or Cold using a simple rule:

* Hot: requested volume is 300 lbs/month or higher, or the inquiry includes urgent or high-growth signals such as rush, urgent, wholesale, scale, growth, or multiple locations.
* Warm: requested volume is 100 lbs/month or higher, or the inquiry has qualified interest signals such as qualified, quote, pricing, partner, sample, referral, or grow.
* Cold: lower-volume or lower-urgency inquiries that should be reviewed after higher-priority items.

The reasoning is that wholesale operators usually need to prioritize the best mix of urgency, volume potential, and buying intent. This rule is intentionally simple, explainable, and easy to adjust.

## How I would extend this for production

If this were going to production, I would connect the app to a real backend instead of local JSON files. Contacted state would be stored in a database with user attribution, timestamps, and audit history. I would also add authentication, role-based access, form validation, loading and error states, and stronger data models.

I would improve reporting by adding true opportunity statuses such as won, lost, contacted, qualified, and pending. That would allow accurate conversion metrics and funnel reporting. I would also add a proper inquiry detail page, assignment to team members, follow-up reminders, CRM integrations, and automated email draft suggestions.

## How I built it

I built this as a static HTML, CSS, and JavaScript app so it can run easily on GitHub Pages without a build process. The dashboard and triage page both read from the provided JSON files using `fetch`.

I used AI assistance to move faster on structure, JavaScript logic, styling, debugging, and copywriting. I worked iteratively by first creating the dashboard, then validating the chart logic, then separating the triage workflow into its own page. I treated each feature as a small step: load data, normalize fields, render metrics, add filters, add triage classification, persist contacted state with `localStorage`, then add the inquiry detail modal.
