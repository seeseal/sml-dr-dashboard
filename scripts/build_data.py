#!/usr/bin/env python3
"""Build data.js for the DR dashboard from the Excel export of the SML DR sheet.

Usage:
  python3 -I build_data.py <input> <out/data.js>

<input> is either the .xlsx file itself, or the JSON file a Google Drive
download_file_content call saves (with a base64 "content" field).

Only month tabs (June, July, ...) are read. Barter / 10k barter / Lists are ignored,
so nothing from them (e.g. the reimbursement note) is published.
Each DR keeps the hyperlink on its name cell (Basecamp to-do).
"""
import base64, datetime, io, json, re, sys
import openpyxl

MONTHS = ["january", "february", "march", "april", "may", "june", "july",
          "august", "september", "october", "november", "december"]

src, out = sys.argv[1], sys.argv[2]
raw = open(src, "rb").read()
if not raw.startswith(b"PK"):                      # Drive JSON wrapper
    raw = base64.b64decode(json.loads(raw)["content"])
wb = openpyxl.load_workbook(io.BytesIO(raw), data_only=True)   # formulas -> their values


def iso(v, tab_year=None):
    if isinstance(v, (datetime.datetime, datetime.date)):
        return v.strftime("%Y-%m-%d")
    m = re.match(r"^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})$", txt(v))   # text like "Jun 22"
    if m and tab_year:
        mi = [x[:3] for x in MONTHS].index(m.group(1).lower()) if m.group(1).lower() in [x[:3] for x in MONTHS] else -1
        if mi >= 0:
            return f"{tab_year}-{mi+1:02d}-{int(m.group(2)):02d}"
    return None


def txt(v):
    return "" if v is None else str(v).strip()


def clean_link(u):
    if not u:
        return None
    u = re.sub(r"/edit(\?.*)?$", "", u.strip())      # open the to-do, not its edit form
    return u if u.startswith("https://") else None


def parse_tab(title):
    """'November', 'Nov', 'Sept', 'November 2027', 'Nov 2027' -> (month 0-11, year or None); else None."""
    t = re.match(r"^([A-Za-z]+)\.?(?:\s+(\d{4}))?$", title.strip())
    if not t:
        return None
    w = t.group(1).lower()
    for i, full in enumerate(MONTHS):
        if w == full or w == full[:3] or (i == 8 and w == "sept"):
            return i, (int(t.group(2)) if t.group(2) else None)
    return None


tabs, prev_m, year = [], -1, None
for ws in wb.worksheets:
    name = ws.title.strip()
    parsed = parse_tab(name)
    if not parsed:
        continue
    m, named_year = parsed
    hdr_row = None
    for r in ws.iter_rows(min_row=1, max_row=10, max_col=12):
        if txt(r[0].value) == "DR":
            hdr_row = r[0].row
            hdr = [txt(c.value).lower() for c in r]
            break
    if hdr_row is None:
        continue
    ix = lambda k: hdr.index(k) if k in hdr else -1
    iR, iD, iB, iA, iT = ix("raised"), ix("due"), ix("brand"), ix("assigned to"), ix("type")
    iS = ix("status")
    if iS < 0:
        iS = (iT if iT >= 0 else iA) + 1            # July has a blank Status header
    rows, dues, raw_cells = [], [], []
    for r in ws.iter_rows(min_row=hdr_row + 1, max_col=max(iS, iT, iA) + 1):
        dr = txt(r[0].value)
        if not dr:
            continue
        g = lambda i: r[i].value if 0 <= i < len(r) else None
        rows.append({
            "name": dr,
            "link": clean_link(r[0].hyperlink.target if r[0].hyperlink else None),
            "raised": iso(g(iR)), "due": iso(g(iD)),
            "brand": txt(g(iB)), "assigned": txt(g(iA)),
            "type": txt(g(iT)) if iT >= 0 else None,
            "status": txt(g(iS)),
        })
        raw_cells.append(r)
        if iso(g(iD)):
            dues.append(g(iD))
    # tab year: most common due-date year with that month, else roll forward from previous tab
    yrs = [d.year for d in dues if d.month == m + 1]
    if named_year:                                  # "January 2027" — the name says the year
        year = named_year
    elif yrs:
        year = max(set(yrs), key=yrs.count)
    elif year is None:
        year = datetime.date.today().year
    elif m < prev_m:
        year += 1
    prev_m = m
    for row, r in zip(rows, raw_cells):
        for k, i in (("raised", iR), ("due", iD)):
            if not row[k] and 0 <= i < len(r):
                row[k] = iso(r[i].value, year)
    tabs.append({"tab": MONTHS[m].capitalize() + ("" if not named_year else " " + str(named_year)), "year": year, "month": m, "hasType": iT >= 0, "rows": rows})

tabs.sort(key=lambda t: (t["year"], t["month"]))
if not tabs:
    sys.exit("No month tabs found - export format changed? Aborting, site left untouched.")

ist = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
payload = {"fetchedAt": datetime.datetime.now(ist).isoformat(timespec="minutes"), "tabs": tabs}
with open(out, "w", encoding="utf-8") as f:
    f.write("window.DR_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n")
for t in tabs:
    print(f'{t["tab"]} {t["year"]}: {len(t["rows"])} DRs, {sum(1 for r in t["rows"] if r["link"])} with links')
