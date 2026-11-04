/**
 * Auto-add new Basecamp DRs to this sheet (TEST).
 * Every hour: asks the dashboard's Basecamp endpoint for open to-dos assigned to
 * Cecil or Prathmesh, and adds any NEW ones as rows in the "Auto DRs (test)" tab.
 *
 * Fills: DR (linked to Basecamp), Raised, Due, Brand (from the Basecamp project), Status = Not Started.
 * Leaves blank for you: Assigned To, Type, Remarks.
 * Never adds the same to-do twice, and skips to-dos already linked anywhere in the sheet.
 * Only to-dos created on/after START_DATE are added (so old pending to-dos don't flood in).
 *
 * Setup (once): Project Settings → Script properties → add DR_SYNC_KEY (same value as in Vercel).
 * Then run setup() once and approve the permissions.
 */
const ENDPOINT = "https://videoteam-dr.vercel.app/api/basecamp/assigned";
const TAB = "Auto DRs (test)";
const HEADER = ["DR", "Raised", "Due", "Brand", "Assigned To", "Type", "Status", "Remarks", "Assigned in Basecamp", "Basecamp project", "Added on"];
const BRAND_BY_PROJECT = { "25726179": "SUGAR", "25838882": "Quench", "27553285": "Pop", "42300492": "Molten" };

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("DR_SYNC_KEY")) throw new Error("Add the DR_SYNC_KEY script property first (Project Settings → Script properties).");
  if (!props.getProperty("START_DATE")) props.setProperty("START_DATE", Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd"));
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === "syncNewDRs").forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncNewDRs").timeBased().everyHours(1).create();
  syncNewDRs();
}

function syncNewDRs() {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty("DR_SYNC_KEY");
  const start = props.getProperty("START_DATE") || "2000-01-01";
  const res = UrlFetchApp.fetch(ENDPOINT + "?key=" + encodeURIComponent(key), { muteHttpExceptions: true });
  const body = JSON.parse(res.getContentText() || "{}");
  if (!body.ok) throw new Error("Basecamp endpoint said: " + (body.reason || res.getResponseCode()));

  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(TAB);
  if (!sh) {
    sh = ss.insertSheet(TAB);
    sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }

  // Every Basecamp to-do already linked anywhere in the sheet (column A of every tab).
  const known = new Set();
  ss.getSheets().forEach(s => {
    const n = s.getLastRow(); if (n < 1) return;
    s.getRange(1, 1, n, 1).getRichTextValues().forEach(r => {
      const url = r[0] && r[0].getLinkUrl(); const m = url && url.match(/\/todos\/(\d+)/);
      if (m) known.add(m[1]);
    });
  });

  const toDate = s => s ? new Date(s.slice(0, 10) + "T00:00:00+05:30") : "";
  const added = [];
  (body.todos || []).forEach(t => {
    if (known.has(t.id)) return;
    const createdDay = Utilities.formatDate(new Date(t.created), "Asia/Kolkata", "yyyy-MM-dd");
    if (createdDay < start) return;
    added.push(t);
  });
  added.sort((a, b) => new Date(a.created) - new Date(b.created));
  added.forEach(t => {
    const row = sh.getLastRow() + 1;
    const created = new Date(t.created);
    sh.getRange(row, 1, 1, HEADER.length).setValues([[
      t.title, new Date(Utilities.formatDate(created, "Asia/Kolkata", "yyyy-MM-dd") + "T00:00:00+05:30"), toDate(t.due),
      BRAND_BY_PROJECT[t.projectId] || "", "", "", "Not Started", "",
      (t.assignees || []).join(", "), t.project || "", new Date()
    ]]);
    sh.getRange(row, 1).setRichTextValue(SpreadsheetApp.newRichTextValue().setText(t.title).setLinkUrl(t.url).build());
    sh.getRange(row, 2, 1, 2).setNumberFormat("mmmm d");
    sh.getRange(row, 11).setNumberFormat("d mmm, h:mm am/pm");
  });
  console.log("Added " + added.length + " new DR(s). Watching: " + (body.watching || []).join(", ") + (body.missing && body.missing.length ? " | Not found in Basecamp: " + body.missing.join(", ") : ""));
}
