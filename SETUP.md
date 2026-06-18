# Setup Guide

This guide connects the self-assessment site to free Google Sheets storage and publishes it using GitHub Pages.

## 1. Create The Google Sheet

1. Open Google Drive.
2. Create a new Google Sheet.
3. Name it `IBD Standards Self-Assessment Responses`.
4. Open `Extensions` then `Apps Script`.
5. Delete any starter code.
6. Paste in the contents of `apps-script/Code.gs`.
7. Save the Apps Script project.
8. Run the `setupWorkbook` function once.
9. Approve the permissions requested by Google.

The workbook will contain:

- `Responses`: anonymous response data, including the private surname hash.
- `Settings`: a plain-English record of the privacy and duplicate rules.

## 2. Deploy The Google Apps Script

1. In Apps Script, select `Deploy` then `New deployment`.
2. Choose type `Web app`.
3. Description: `IBD Standards self-assessment API`.
4. Execute as: `Me`.
5. Who has access: `Anyone`.
6. Deploy.
7. Copy the Web app URL.

This URL lets the GitHub Pages site send responses into your Sheet and read anonymous summary data back for the dashboard.

## 3. Connect The Site To Google Sheets

1. Open `docs/config.js`.
2. Replace the blank `API_URL` value with your Apps Script Web app URL.
3. Update `SERVICE_NAME` if desired.

Example:

```js
window.IBD_CONFIG = {
  SERVICE_NAME: "Example Hospital IBD Service",
  API_URL: "https://script.google.com/macros/s/EXAMPLE/exec",
  DASHBOARD_TITLE: "IBD Standards Self-Assessment Dashboard"
};
```

## 4. Publish With GitHub Pages

1. Create a new GitHub repository.
2. Upload or push this project to the repository.
3. In GitHub, open `Settings`.
4. Open `Pages`.
5. Under `Build and deployment`, choose:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/docs`
6. Save.
7. Wait for GitHub to show the published site URL.

The site URL will usually look like:

```text
https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/
```

## 5. Test The Workflow

1. Open the published site.
2. Submit one test assessment.
3. Confirm the Google Sheet has one response row.
4. Submit again using the same surname.
5. Confirm the original row is updated rather than duplicated.
6. Open the dashboard tab and check that the respondent count remains correct.

## 6. Create The QR Code

Use the published GitHub Pages URL as the target.

Free options:

- In Chrome, open the site URL, choose the address bar share icon, then create a QR code.
- In Microsoft Edge, open the site URL, choose the QR code icon in the address bar.
- Or use any trusted free QR generator approved by your organisation.

Save the QR image and insert it into the invitation email.

## 7. Export The Dashboard Report

1. Open the dashboard tab.
2. Select `Export PDF`.
3. Choose `Save as PDF`.
4. Save the report for circulation or meeting papers.

## Privacy Notes

- The respondent enters their surname only to prevent duplicate responses.
- The surname is sent to your Google Apps Script and immediately converted into a one-way hash.
- The raw surname is not saved in the Google Sheet.
- A repeated surname replaces the earlier response.
- The dashboard displays aggregate ratings and free-text comments only.

## Practical Caveat

Surname-only duplicate checking can merge two different staff members who share the same surname. If that is likely in your team, use an agreed private respondent code instead, or ask for `surname plus first initial` and update the form wording accordingly.
