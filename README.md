# IBD Standards Self-Assessment Workflow

This project provides a free workflow for an IBD service team to complete an anonymous online self-assessment against the IBD UK Standards 2026 and view a live dashboard of team responses.

## What Is Included

- A static assessment and dashboard site in `docs/`, suitable for GitHub Pages.
- Extracted standards data in `docs/standards.json`.
- A Google Apps Script backend in `apps-script/Code.gs` for saving responses to a Google Sheet.
- A privacy-preserving duplicate check using a hashed surname.
- Dashboard dials showing median rating, minimum and maximum rating, and submitted comments.
- Browser PDF export for the dashboard.
- Setup instructions in `SETUP.md`.
- Reusable email invitation text in `invitation-email.md`.

## Local Preview

Open the site through a small local web server from the project folder:

```sh
python3 -m http.server 8000 -d docs
```

Then visit:

```text
http://localhost:8000
```

Until Google Sheets is connected, the site runs in demo mode and stores test responses only in the current browser.
