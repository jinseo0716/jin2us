module.exports = async (req, res) => {
  const SUPABASE_URL = 'https://bctuwpnusbbbmvwfyfix.supabase.co';
  const SUPABASE_KEY = 'sb_publishable__n8oRkJGFRKJkr-HgM4LqQ_RR8n76ml';
  const TABLE_URL = SUPABASE_URL + '/rest/v1/kv_store';
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  try {
    const key = req.query.key || '';
    const isShared = req.query.shared === 'true';
    const base = isShared ? 'shared:' : 'user:';
    const fullKey = base + key;

    if (req.method === 'GET' && req.query.list === '1') {
      const prefix = req.query.prefix || '';
      const full = base + prefix;
      const r = await fetch(TABLE_URL + '?key=like.' + encodeURIComponent(full) + '*&select=key', { headers });
      const rows = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: rows });
      const keys = (rows || []).map((row) => row.key.slice(base.length));
      return res.status(200).json({ keys, prefix, shared: isShared });
    }

    if (req.method === 'GET') {
      const r = await fetch(TABLE_URL + '?key=eq.' + encodeURIComponent(fullKey) + '&select=value', { headers });
      const rows = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: rows });
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Key not found: ' + key });
      return res.status(200).json({ key, value: rows[0].value, shared: isShared });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      const value = body && body.value;
      const r = await fetch(TABLE_URL + '?on_conflict=key', {
        method: 'POST',
        headers: Object.assign({}, headers, { Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify([{ key: fullKey, value: value, shared: isShared }])
      });
      if (!r.ok) {
        const t = await r.text();
        return res.status(r.status).json({ error: t });
      }
      return res.status(200).json({ key, value, shared: isShared });
    }

    if (req.method === 'DELETE') {
      const r = await fetch(TABLE_URL + '?key=eq.' + encodeURIComponent(fullKey), {
        method: 'DELETE',
        headers: Object.assign({}, headers, { Prefer: 'return=representation' })
      });
      const rows = await r.json();
      if (!r.ok) return res.status(r.status).json({ error: rows });
      return res.status(200).json({ key, deleted: !!(rows && rows.length), shared: isShared });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
};
