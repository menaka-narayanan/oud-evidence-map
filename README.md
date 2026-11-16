# OUD Policy Evidence Map

An interactive map of peer-reviewed studies of opioid use disorder policy. Reviewers code studies in a Google Sheet; this website reads that sheet each time someone opens it, so edits appear on the site within about 5 minutes. There is no server, database or build step.

## What's in this folder

| File | What it is | Who edits it |
| --- | --- | --- |
| `config.js` | Site title and intro, the link to the Google Sheet, and the vocabulary (how sheet values are grouped and labelled) | Anyone, for routine changes |
| `data/snapshot.csv` | A saved copy of the sheet, used if Google can't be reached | Replace it a few times a year |
| `index.html`, `style.css`, `app.js` | The page, its look, and its logic | Only for design or feature changes |
| `CLAUDE.md` | Instructions for Claude when it helps maintain the site | Rarely |

## One-time setup

### 1. Put the site on GitHub Pages (free)

1. Sign in to GitHub and create a new **public** repository, ideally in a GitHub organization the team owns rather than a personal account. Give at least two people admin access.
2. On the new repository's page, choose **Add file → Upload files**, drag in everything in this folder (including the `data` folder and the hidden `.nojekyll` file), and click **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose the `main` branch and the `/ (root)` folder, and click **Save**.
4. After a minute or two the site is live at `https://<account>.github.io/<repository>/`.

### 2. Connect the Google Sheet

1. In the sheet, choose **File → Share → Publish to web**.
2. Pick the tab that holds the studies, choose **Comma-separated values (.csv)**, and click **Publish**. Copy the link it gives you.
3. On GitHub, open `config.js`, click the pencil icon to edit, paste the link between the quotes after `sheetCsvUrl:`, and commit.

Publishing makes that tab readable by anyone with the link. If the sheet holds drafts or reviewer names, make a separate tab that shows only finished rows and the public columns, and publish only that tab. Alternatively, add a `Status` column and set `onlyStatus: "Final"` in `config.js`.

The sheet needs these column headers (case and extra words after them don't matter): **Title, Policy Intervention, Outcome 1–4, Study Design, Year**. Other columns the site uses if present: Policy Intervention Text, Specific policy, Policy Category, Detailed Article Exposure, Detailed Article Outcomes, Journal, Government Level, Scope, Population 1–3, # Participants (and "- Categorized"), Study Duration (and "- Categorized"), Funding, Funding - Group, Link, Strength of Evidence, Article ID, Status, and the Intervention columns.

### 3. Use a custom domain

1. Buy a domain from any registrar (around $10–20 a year), or ask your institution's IT team for a subdomain such as `oudmap.yourschool.edu`.
2. In the domain's DNS settings, add a record:
   - **For a subdomain** (e.g. `map.example.org`): a `CNAME` record pointing to `<account>.github.io`.
   - **For a root domain** (e.g. `example.org`): four `A` records pointing to `185.199.108.153`, `185.199.109.153`, `185.199.110.153` and `185.199.111.153`.
3. On GitHub, go to **Settings → Pages → Custom domain**, enter the domain, and click **Save**.
4. Once GitHub shows the domain as verified (minutes to a day, while DNS updates), tick **Enforce HTTPS**.

## Routine upkeep

| Task | How |
| --- | --- |
| Add or edit a study | Edit the Google Sheet. The site picks it up within about 5 minutes. |
| A category shows up spelled two ways | Add the variant to the matching list in `config.js`, e.g. `"cross sectional": "Cross-sectional"`. |
| Add a new policy or outcome to the map | Add it to `policyGroups` or `outcomeGroups` in `config.js`. Policies not listed still appear under "Other policy". |
| Refresh the saved copy | In the sheet, **File → Download → Comma-separated values**. On GitHub, open the `data` folder, **Add file → Upload files**, upload it as `snapshot.csv`, then update `snapshotDate` in `config.js`. |
| Check for data problems | Open the site, press F12 (or right-click → Inspect), and open the **Console** tab. The site lists duplicates and rows missing a policy or outcome. |

Changes committed on GitHub go live in about a minute.

## Getting Claude's help

For anything beyond the table above (a new figure, a layout change, a new column in the sheet), open the repository in Claude Code (claude.ai/code, or the Claude desktop app) and describe what you want in plain language. Claude reads `CLAUDE.md` for how this site is put together. Review its change, then let it commit; the site updates in about a minute.

## Trying changes on your own computer

Opening `index.html` directly from your computer won't load the data, because browsers block that. From this folder, run `python3 -m http.server 8000`, then open http://localhost:8000.
