// Returns when each DR's Basecamp to-do was created and ticked off.
// Public, but only for to-dos linked from the dashboard, and cached at Vercel's edge
// so Basecamp is asked at most every few hours.
const fs = require("fs");
const path = require("path");
const { ACCOUNT_ID, UA, accessToken } = require("./_lib");

function todoIds() {
  const js = fs.readFileSync(path.join(process.cwd(), "data.js"), "utf8");
  const data = JSON.parse(js.slice(js.indexOf("{"), js.lastIndexOf("}") + 1));
  const ids = new Set();
  for (const t of data.tabs) for (const r of t.rows) {
    const m = r.link && r.link.match(/\/todos\/(\d+)/);
    if (m) ids.add(m[1]);
  }
  return [...ids];
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (req, res) => {
  let token;
  try { token = await accessToken(); }
  catch (e) {
    res.setHeader("Cache-Control", "s-maxage=300");
    return res.status(503).json({ ok: false, reason: e.message });
  }
  const ids = todoIds(), out = {}, missing = [];
  // Basecamp allows ~50 requests per 10 s: run 4 at a time with a small gap.
  let i = 0;
  async function worker() {
    while (i < ids.length) {
      const id = ids[i++];
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await fetch(`https://3.basecampapi.com/${ACCOUNT_ID}/todos/${id}.json`, { headers: { Authorization: "Bearer " + token, "User-Agent": UA } });
        if (r.status === 429) { await sleep((+r.headers.get("retry-after") || 5) * 1000); continue; }
        if (!r.ok) { missing.push(id); break; }
        const t = await r.json();
        const done = t.completed && t.completion;
        out[id] = {
          created: t.created_at,
          starts: t.starts_on || null,
          due: t.due_on || null,
          closed: done ? t.completion.created_at : null,
          closedBy: done && t.completion.creator ? t.completion.creator.name : null,
          assignees: (t.assignees || []).map(a => a.name),
        };
        break;
      }
      await sleep(250);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  res.setHeader("Cache-Control", "public, s-maxage=21600, stale-while-revalidate=86400");
  res.json({ ok: true, fetchedAt: new Date().toISOString(), todos: out, missing });
};
