# DR Dashboard — Video Team (SUGAR Media Labs)

Owner: Cecil Sam Mathew (video@vellvette.com)

## What this is
A one-page dashboard of the Video Team's DR (deliverable request) list, by month,
for managers. Goal: understand the month in 5 seconds.
Dark theme, black + orange (#FF6B1A). Layout follows a dark sidebar + card grid.

- Live page (Claude artifact): https://claude.ai/artifact/DLHSwmRFcVA2CTfwppd4vD
- Artifact slug: `63deee7b-35d6-43b4-87e2-5100c57f23ea`
- Source sheet: "SML DR Sheet VT - 2026"
  https://docs.google.com/spreadsheets/d/1fCvUYFMAmWOy67kbWopl5OpHV2ZxY96okwEpro148EM/edit
  (Google Drive file id `1fCvUYFMAmWOy67kbWopl5OpHV2ZxY96okwEpro148EM`, owner videoteam@sugarcosmetics.com)

## Files
| File | Role |
|---|---|
| `index.html` | The whole page: layout, styles, CSV parser, all calculations, charts. No libraries. |
| `data.js` | Data only: `window.DR_DATA = {fetchedAt, tabs:[{tab, year, month, hasType, rows:[{name, link, raised, due, brand, assigned, type, status}]}]}`. The only file the daily refresh replaces. |
| `build_data.py` | Turns the Excel export of the sheet (or Drive's saved JSON of it) into `data.js`. Keeps **only month tabs** (drops Barter, 10k barter, Lists — those hold a reimbursement note and other non-DR data that must not be published). |
| `CLAUDE.md` | This file. |

## Daily refresh (scheduled task "DR Dashboard daily refresh", 10:36 AM IST so it is ready by 11)
1. Google Drive `download_file_content` on the sheet id with exportMimeType xlsx. The result is large, so it is
   saved to a file (JSON with base64 `content`) — nothing is retyped by hand.
2. `python3 -I build_data.py <that file> data.js` (needs openpyxl). Reads month tabs only, keeps the
   Basecamp hyperlink on each DR name (strips `/edit?replace=true` so it opens the to-do).
3. `get_artifact` → `version`; `publish_files` with slug, base_version, mode "patch", only `data.js`.
   Never republish `index.html` from the task — layout changes are made by hand.
Runs in the cloud (Mac can be off). The copy of `data.js` in this folder is not updated by the task.

## How the numbers are worked out (in index.html)
- **One month = one sheet tab.** A DR that sits in a tab counts for that month, even if it was raised earlier (the team carries unfinished DRs forward). "Carried over" = raised before that month.
- Header row is the row whose first cell is `DR`. Columns found by name: Raised, Due, Brand, Assigned To, Type (Sep onwards), Status. July's Status header is blank → status is taken as the column after Assigned To.
- Only the left-hand DR columns are read; the "Quick View" summary blocks on the right of the sheet are ignored (their formulas don't add up — e.g. Oct shows Done 47 + In Progress 5 + Open 12 + Scrapped 4 = 68 against a total of 60).
- Dates come from the Excel export as real dates with years. Formula cells (e.g. a row that is `=A82`) are read as their values.
- DR names link to their Basecamp to-do (the hyperlink on the name cell in the sheet).
- Status: Done/Approved → **Delivered**. NA/Scrapped → **Scrapped** (excluded from open/overdue). Blank → "No status" (counted as open, not started).
- **Overdue** = open and due date before today (IST, at viewing time).
- Assigned To with several names ("Jatin, Cecil") counts for each person. Blank → "Unassigned".
- Brand normalised: Pop → SUGAR POP, Quench → QUENCH; blank brand → "No brand" (June tab has no brands filled).
- **All months** view counts each DR once: a DR carried into later tabs is counted at its latest tab/status. Month cards show per-tab counts with change vs previous month.
- Brand filter (pills, or tap a brand card) applies to the whole page.

## Team changes
`TEAM_EXITS` at the top of the script in `index.html` lists people who have left:
`{name:"Jatin", year:2026, month:10}` (month 10 = November). From that month on their name is removed
from DRs; a DR with no one left shows as "Unassigned" and is flagged under Sheet hygiene as needing a new owner.
Months before keep their name. To add someone, add a line there and republish `index.html`.

## Known data gaps (worth fixing in the sheet)
- No "delivered on" date, so on-time delivery % can't be measured — only "overdue right now". Adding a `Delivered On` column would unlock real TAT / on-time %.
- Nov tab: many DRs without owner/status (shown as "Sheet hygiene" on the page).
- Some duplicate rows (e.g. "Acne patch UGC", "Strobe Cream" in July).
- Each new month needs a tab named exactly after the month (e.g. `December`) with the same header row; the page picks it up automatically.

## Editing the look
Colours are CSS variables at the top of `index.html` (`--or` = orange, `--bg`, `--panel`).
After editing: publish `index.html` with `publish_files` (slug above, patch mode). Check at 1440px and 390px wide.
