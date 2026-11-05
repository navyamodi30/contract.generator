// Vercel serverless function: /api/contract
// Forwards the student's actions to the Apps Script backend and adds what Apps Script can't see:
// the student's real IP address and browser. The PROXY_KEY proves to the backend that the IP is genuine.
//
// Vercel → Project → Settings → Environment Variables:
//   APPS_SCRIPT_URL   the Student API deployment URL (ends in /exec)
//   PROXY_KEY         same value as the PROXY_KEY script property in Apps Script

const ALLOWED = ['view', 'document', 'accept', 'download'];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'POST only' });

  const url = process.env.APPS_SCRIPT_URL;
  const key = process.env.PROXY_KEY;
  if (!url || !key) return res.status(500).json({ ok: false, error: 'The signing service is not configured yet.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  if (!ALLOWED.includes(body.action)) return res.status(400).json({ ok: false, error: 'Unknown action' });

  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const payload = {
    action: body.action,
    token: body.token,
    ticked: body.ticked,
    typed_name: body.typed_name,
    doc_sha256: body.doc_sha256,
    proxy_key: key,
    ip: fwd || String(req.headers['x-real-ip'] || ''),
    ua: String(req.headers['user-agent'] || '').slice(0, 200)
  };

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });
    const text = await r.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(text);
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'Could not reach the signing service. Please try again.' });
  }
};
