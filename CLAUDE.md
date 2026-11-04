# DR Dashboard — Video Team (SUGAR Media Labs)

Owner: Cecil Sam Mathew (video@vellvette.com)

## What this is
A one-page dashboard of the Video Team's DR (deliverable request) list, by month,
for managers. Goal: understand the month in 5 seconds.
Dark theme, black + orange (#FF6B1A). Layout follows a dark sidebar + card grid.

- Live site (Vercel): https://videoteam-dr.vercel.app (also https://vt-dr-dashboard-k7q2-ten.vercel.app)  (project `vt-dr-dashboard-k7q2`, id `prj_Y7bt3CWuj6wIG40dWEeRAHVjUB9L`)
  Deploys automatically on every push to `main` of GitHub `seeseal/sml-dr-dashboard`. Public URL — share only with the people who need it.
- Private copy (Claude artifact): https://claude.ai/artifact/DLHSwmRFcVA2CTfwppd4vD
- Artifact slug: `63deee7b-35d6-43b4-87e2-5100c57f23ea`
- Source sheet: "SML DR Sheet VT - 2026"
  https://docs.google.com/spreadsheets/d/1fCvUYFMAmWOy67kbWopl5OpHV2ZxY96okwEpro148EM/edit
  (Google Drive file id `1fCvUYFMAmWOy67kbWopl5OpHV2ZxY96okwEpro148EM`, owner videoteam@sugarcosmetics.com)

## Files
| File | Role |
|---|---|
| `index.html` | The whole page: layout, styles, all calculations, charts. No libraries. |
| `data.js` | Data only: `window.DR_DATA = {fetchedAt, tabs:[{tab, year, month, hasType, rows:[{name, link, raised, due, brand, assigned, type, status}]}]}`. The only file the daily refresh replaces. |
| `scripts/build_data.py` | Turns the Excel export of the sheet (or Drive's saved JSON of it) into `data.js`. Keeps **only month tabs** (drops Barter, 10k barter, Lists — those hold a reimbursement note and other non-DR data that must not be published). |
| `api/basecamp/*.js` | Vercel functions for Basecamp: `connect` + `callback` (one-time login), `closed` (created / ticked-off dates for every linked to-do; edge-cached 6 h). `_lib.js` is shared code, not an endpoint. |
| `vercel.json`, `robots.txt` | Static hosting: no-index headers, `data.js` never cached. |
| `CLAUDE.md` | This file. |

## Daily refresh (scheduled task "DR Dashboard daily refresh", 10:36 AM IST so it is ready by 11)
Runs fully on its own (automatic approval) — no one needs to approve or answer anything.
1. Google Drive `download_file_content` on the sheet id with exportMimeType xlsx. The result is large, so it is
   saved to a file (JSON with base64 `content`) — nothing is retyped by hand.
2. Clone this repo. Refresh the Basecamp cache: curl `/api/basecamp/closed` (with `?full=1` on Mondays, IST) and run
   `python3 -I scripts/update_bc_cache.py <answer> bc_closed.json`. If Basecamp fails, the cache is left unchanged.
3. Run `python3 -I scripts/build_data.py <xlsx file> data.js` (needs openpyxl). Reads month tabs only, keeps each DR's Basecamp link.
4. Commit `data.js` + `bc_closed.json` in one push to `main` → Vercel redeploys on its own.
5. Wait ~90 s, curl `/api/basecamp/closed` once to warm the cache.
6. Also publish `data.js` to the Claude artifact (get_artifact → publish_files, patch mode).
Never change `index.html` from the task — layout changes are made by hand and pushed.

## How the numbers are worked out (in index.html)
- **One month = one sheet tab.** A DR that sits in a tab counts for that month, even if it was raised earlier (the team carries unfinished DRs forward). "Carried over" = raised before that month.
- Header row is the row whose first cell is `DR`. Columns found by name: Raised, Due, Brand, Assigned To, Type (Sep onwards), Status. July's Status header is blank → status is taken as the column after Assigned To.
- Only the left-hand DR columns are read; the "Quick View" summary blocks on the right of the sheet are ignored (their formulas don't add up — e.g. Oct shows Done 47 + In Progress 5 + Open 12 + Scrapped 4 = 68 against a total of 60).
- Dates come from the Excel export as real dates with years. Formula cells (e.g. a row that is `=A82`) are read as their values.
- DR names link to their Basecamp to-do (the hyperlink on the name cell in the sheet).
- Status: Done/Approved → **Done**. NA/Scrapped → **Dropped** (not counted as pending or late). Blank → "Not started" (counted as pending). Page wording: Done / Pending / Late; "In review" = Pending Review in the sheet.
- **Overdue** = open and due date before today (IST, at viewing time).
- Assigned To with several names ("Jatin, Cecil") counts for each person. Blank → "Not assigned".
- Brand normalised: Pop → SUGAR POP, Quench → QUENCH; blank brand → "No brand" (June tab has no brands filled).
- **All months** view counts each DR once: a DR carried into later tabs is counted at its latest tab/status. Month cards show per-tab counts with change vs previous month.
- Brand filter (pills, or tap a brand card) applies to the whole page.

## Basecamp turnaround (live since 4 Nov 2026)
- Basecamp app "Video Team DR Dashboard" registered at launchpad.37signals.com/integrations.
  Redirect URI: https://videoteam-dr.vercel.app/api/basecamp/callback. Account id 3985435.
- Vercel env vars (Production, Sensitive): `BASECAMP_CLIENT_ID`, `BASECAMP_CLIENT_SECRET`, then after
  the one-time connect, `BASECAMP_REFRESH_TOKEN` (shown once on the callback page). Never put these in chat or the repo.
- One-time connect: open https://videoteam-dr.vercel.app/api/basecamp/connect → approve → copy the key → add env var → redeploy.
- The page fetches `/api/basecamp/closed`. A DR counts as **Done if the sheet OR Basecamp says so**.
  **Dates come from Basecamp** (sheet only as fallback): Created = to-do created, Due = to-do due date,
  Closed = tick-off time, Closed by = who ticked it off (often the requester, e.g. Simran Shukla / Sarrah Vohra,
  so it can mean "approved" rather than "delivered"). Basecamp due differs from the sheet for ~30% of DRs.
  "Open for" = Created → tick-off, or → today if still pending.
- **Reused to-dos are excluded from turnaround**: ~20 DRs link to an old to-do created 30+ days before the
  sheet's Raised date, so their Created date isn't when the DR started. They still appear in Closed DRs.
- **Batch clean-ups are excluded from turnaround**: 5+ to-dos ticked off within 30 minutes (e.g. 28 Oct 10:10–10:23,
  13 to-dos incl. ones due in May) are bookkeeping, not deliveries. The page says how many were skipped.
- Closed DRs table: DR, brand, created, due, closed, closed by, days taken, and early/late vs due (batch clean-ups tagged). No owner column (removed at Cecil's request).
- Pending DRs table: DR, brand, **Assigned** (the sheet's Assigned To), created, due, open for, status, late/due-in.
- Figures shown: typical (median) and average time to close, slowest, longest still pending, typical per person.
  "Closed on time %" was removed: tick-offs lag delivery (median 7 days after due), so it isn't trustworthy yet.
- Mismatches (ticked off in Basecamp but not Done in sheet, and the reverse) are listed under "To fix in the sheet".
- Blank status is shown as "Not started"; blank owner as "Not assigned".

## Sheet automation — "DR Sync" Apps Script (live since 4 Nov 2026, v3 since 4 Nov 16:40)
Everything here lives inside the Google Sheet. Nothing on the Vercel site, no extra tabs.
Team rule (Cecil, 4 Nov): **nobody adds or copies DR rows by hand** — Basecamp → sheet is automatic.

### Where it is
- Apps Script project **"DR Sync"**, bound to the DR sheet, owned by **videoteam@sugarcosmetics.com**.
  Script id `1nMR3aiF8-EPw5bomzPw9bngVtW7ZQkn-BxShsZdcirrQZNakuD1qDxfG`.
  Editor: `https://script.google.com/u/1/home/projects/1nMR3aiF8-EPw5bomzPw9bngVtW7ZQkn-BxShsZdcirrQZNakuD1qDxfG/edit`
- Code copy in this folder: `sheet-script/DR-Sync.gs` = the project's single `Code.gs`. Keep identical
  (edit in the editor, save, copy the same text here; compare lengths).
- Basecamp app **"DR Sheet Sync"** (launchpad integration 31983), separate from the dashboard's app.
  Redirect URI `https://script.google.com/macros/d/<script id>/usercallback`. Connected as Basecamp user
  **Cecil Mathew (#46712153)**.
- Secrets: Basecamp Client ID/Secret + access/refresh tokens in the script's **User properties** (videoteam account),
  entered via the menu. Never in the sheet, the repo, or chat.
- Script **Document properties**:
  - `SEEN_0`, `SEEN_1`, … — Basecamp to-do ids already handled (added, carried, or present at baseline). Split in
    chunks of 550 because one property holds max 9 KB (a single list would have broken at ~600 DRs).
  - `BASELINE_V2` — when the baseline was taken (4 Nov 2026, 16:36). Before it, every to-do that was already
    assigned (29) was marked as seen so the backlog never floods in. If this property is deleted, the next run
    re-takes the baseline instead of adding anything.
  - `ALERT_…` — when each kind of failure was last emailed (for the once-a-day limit).
- Config at the top of the code (`CFG`):
  `watch` (Basecamp names: "Cecil Mathew", "Prathmesh Shetye"), `alertTo` (video@vellvette.com),
  `legacyYear` (2026), `exited` ([{name:"Jatin", from:"2026-11"}]).

### Triggers (Apps Script → Triggers)
| Function | When | What it does |
|---|---|---|
| `syncNewDRs` | every hour | Adds DRs newly assigned in Basecamp to the current month tab |
| `monthlyRollover` | 1st of every month, ~6 AM IST | Creates the new month tab and carries over open DRs |
Both run on Google's servers as videoteam@ — the sheet doesn't need to be open. Both share one lock, so they never
run at the same time.

### 1) Hourly: add newly assigned DRs (`syncNewDRs`)
- Reads Basecamp's "assigned to-dos" for everyone in `CFG.watch`. Basecamp leaves the connected user (Cecil) out of
  its people list, so the script adds them back via `/my/profile.json` (bug found and fixed 4 Nov).
  If a watched name isn't found, the run fails with "Not found in Basecamp: …" (and emails an alert).
- A to-do is added when it is open and **not** in `SEEN` and **not** already linked in column A of any tab.
  This means: a to-do assigned later (even if it was created long ago) is added when it's assigned; a deleted row
  never comes back.
- If this month's tab has a row with the same title but no link, the script **adds the link to that row** instead of
  creating a duplicate.
- Target tab: current month (IST). If it doesn't exist yet, the latest month tab.
- Writes below the last DR, only: **DR** (title + Basecamp link), **Raised** (Basecamp created date),
  **Due** (Basecamp due date), format "mmmm d". Brand, Assigned To, Type, Status, Remarks stay blank.

### 2) Monthly: new tab + carry-over (`monthlyRollover`)
On the 1st:
1. If the new month's tab already exists → does nothing (safe to re-run).
2. Duplicates **last month's tab** (formatting, dropdowns, Quick View), names it, places it after last month,
   updates A1 if it holds a month name, clears the DR rows (DR…Remarks below the header; notes too).
3. Copies every **open** DR, whole row: DR + link, Raised, Due, Brand, Assigned To, Type, Status, Remarks.
   - Open = Status not Done / Approved / NA / Scrapped (blank = open) **and** the Basecamp to-do isn't ticked off.
   - **Each Basecamp to-do is carried once** — duplicate rows pointing to the same to-do are skipped and listed.
   - Rows with no Basecamp link are carried and listed ("please add the link").
   - If Assigned To includes someone in `CFG.exited`, the person stays but the cell gets a note
     "<name> has left the team — please reassign" and it's listed.
4. Emails a summary to `CFG.alertTo`: tab created, how many carried, what was skipped/flagged.
- Dry run anytime: **DR Sync → Preview next month's carry-over** (changes nothing). 4 Nov preview: 20 DRs would
  move to December; "Quench We're Back Episode 2 Sukhada" flagged ← reassign.

### Tab names and years
- 2026 tabs keep plain names ("November"). From 2027 the script names new tabs **with the year** —
  1 Jan 2027 creates **"January 2027"** — so November 2027 can never clash with November 2026.
- Recognised as month tabs: "November", "Nov", "Sept", "November 2027", "Nov 2027". Anything else is ignored
  (Barter, Lists, …).
- If the header row is missing/renamed, the run fails with a clear message naming the tab (and emails an alert).

### Failure alerts
- Any failure of the hourly or monthly job emails **video@vellvette.com** — at most once a day per distinct
  problem (so a stuck job can't spam). The job keeps retrying on schedule.
- `testAlert` (run in the editor) sends a test email. Sent successfully 4 Nov 16:34.

### DR Sync menu (in the sheet, as videoteam@)
1 Enter Basecamp app keys · 2 Connect Basecamp · 3 Start hourly sync (also sets the monthly trigger) ·
Sync now · Stop hourly sync · Preview next month's carry-over.
Editor-only helpers: `seedBaseline`, `setupMonthly`, `previewRollover`, `testAlert`, `debugPeople`, `moveTestRows` (one-off, done).

### Gotchas
- Two Google accounts in Chrome: the menu and the connect step fail ("unable to open the file"). Open the sheet via
  `https://docs.google.com/spreadsheets/u/1/d/1fCvUYFMAmWOy67kbWopl5OpHV2ZxY96okwEpro148EM/edit`; do any reconnect in
  an Incognito window signed in only as videoteam@.
- Adding a new scope to the code (e.g. a new Google service) pauses the triggers until someone re-authorises:
  run any function in the editor and click Review permissions → Allow.
- Not fixed yet (Cecil, later): it adds *any* to-do assigned to the watched people, not only video DRs (#11);
  both Basecamp connections depend on Cecil's Basecamp login (#6).

## Team changes
`TEAM_EXITS` at the top of the script in `index.html` lists people who have left:
`{name:"Jatin", year:2026, month:10}` (month 10 = November). From that month on their name is removed
from DRs; a DR with no one left shows as "Not assigned" and is flagged under "To fix in the sheet" as needing a new owner.
Months before keep their name. To add someone, add a line there and republish `index.html`.

## Known data gaps
- Close dates come from Basecamp tick-offs, which are also manual (often the requester ticks it, sometimes in batch clean-ups). Reliable only if the team agrees when to tick off.
- Nov tab: many DRs without owner/status (shown under "To fix in the sheet" on the page).
- Some duplicate rows (e.g. "Acne patch UGC", "Strobe Cream" in July).
- Each new month needs a tab named exactly after the month (e.g. `December`) with the same header row; the page picks it up automatically.

## Dashboard fixes of 4 Nov 2026 (live since 4 Nov, ~4:45 PM IST)
- **All months counts each DR once by its Basecamp to-do** (`index.html`, uniqueAll): a renamed DR is still one DR;
  rows without a link fall back to name + brand. Effect on 4 Nov data: 307 → 299 unique DRs.
- **Batch clean-up rule tightened** (`index.html`): 5+ tick-offs within 30 minutes count as a clean-up only if 60%+ of
  them were already 7+ days past due. A burst of on-time deliveries now counts. Effect: 25 → 20 DRs excluded.
- **Tab names** (`scripts/build_data.py`): reads "Nov", "Sept", "November 2027", "Jan 2027" as month tabs;
  a year in the name wins over the guessed year; tabs are sorted by year/month.
- **Basecamp cache** (`api/basecamp/closed.js`, `bc_closed.json`, `scripts/update_bc_cache.py`, `vercel.json`):
  ticked-off to-dos are read from `bc_closed.json` (241 on 4 Nov), so the daily lookup asks Basecamp only about open
  to-dos (38 instead of 279). `?full=1` re-checks everything and drops reopened to-dos from the cache.

## Working rules (from Cecil)
- Make changes locally in the Dashboard Tracker folder first; push to Vercel only when Cecil says it's final.
- Sheet automation (auto-adding DRs from Basecamp) lives entirely in the Google Sheet's Apps Script — do not add anything to the Vercel site for it.
- Owner/assignee names come from the sheet's Assigned To. Don't show them where Cecil has asked them removed (Closed DRs).
- Wording: plain and short — Done / Pending / Late, "Not started", "Not assigned".

## Editing the look
Colours are CSS variables at the top of `index.html` (`--or` = orange, `--bg`, `--panel`).
After editing: push `index.html` to `main` (Vercel) and publish it to the artifact with `publish_files` (patch mode). Check at 1440px and 390px wide.
