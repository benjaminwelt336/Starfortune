export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const base = 'https://api.laozhang.ai/v1/chat/completions';
  const key = process.env.OPENAI_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  let payload = {};
  try { payload = JSON.parse(Buffer.concat(buffers).toString() || '{}'); } catch {}
  payload.model = payload.model || model;
  const r = await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify(payload)
  });
  const data = await r.text();
  res.status(r.status).send(data);
}