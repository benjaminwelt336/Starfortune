export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.OPENAI_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // 读取请求体
  const chunks = [];
  for await (const c of req) chunks.push(c);
  let payload = {};
  try { payload = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch {}
  payload.model = payload.model || model;

  // 代理到 laozhang
  const r = await fetch('https://api.laozhang.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(payload)
  });

  // 统一按 JSON 返回
  let text = await r.text();
  try {
    const json = JSON.parse(text);
    res.status(r.status).json(json);
  } catch {
    res.setHeader('Content-Type', 'application/json');
    res.status(502).json({ error: 'upstream_not_json', body: text });
  }
}
