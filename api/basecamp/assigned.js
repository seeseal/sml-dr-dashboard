// Open Basecamp to-dos assigned to the watched people (test: Cecil + Prathmesh).
// Called hourly by the Apps Script in the DR sheet, which adds new ones as rows.
// Private: needs ?key= matching the DR_SYNC_KEY env var in Vercel.
const { ACCOUNT_ID, UA, accessToken } = require("./_lib");

const WATCH = ["Cecil Mathew", "Prathmesh Shetye"];   // Basecamp display names

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.DR_SYNC_KEY || (req.query || {}).key !== process.env.DR_SYNC_KEY)
    return res.status(401).json({ ok: false, reason: "bad_key" });
  let token;
  try { token = await accessToken(); }
  catch (e) { return res.status(503).json({ ok: false, reason: e.message }); }
  const get = async path => {
    const r = await fetch(`https://3.basecampapi.com/${ACCOUNT_ID}${path}`, { headers: { Authorization: "Bearer " + token, "User-Agent": UA } });
    if (!r.ok) throw new Error(path + " " + r.status);
    return r.json();
  };
  try {
    const people = await get("/reports/todos/assigned.json");
    const watched = people.filter(p => WATCH.some(n => n.toLowerCase() === String(p.name).toLowerCase()));
    const todos = new Map();
    for (const p of watched) {
      const rep = await get(`/reports/todos/assigned/${p.id}.json?group_by=bucket`);
      for (const t of rep.todos || []) {
        if (t.completed || todos.has(t.id)) continue;
        todos.set(t.id, {
          id: String(t.id), title: t.title, url: t.app_url,
          project: t.bucket && t.bucket.name, projectId: t.bucket && String(t.bucket.id),
          list: t.parent && t.parent.title,
          created: t.created_at, starts: t.starts_on || null, due: t.due_on || null,
          assignees: (t.assignees || []).map(a => a.name),
          createdBy: t.creator && t.creator.name,
        });
      }
    }
    res.json({ ok: true, watching: watched.map(p => p.name), missing: WATCH.filter(n => !watched.some(p => p.name.toLowerCase() === n.toLowerCase())), todos: [...todos.values()] });
  } catch (e) {
    res.status(502).json({ ok: false, reason: e.message });
  }
};
