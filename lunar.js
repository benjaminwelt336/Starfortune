export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const token = process.env.ALAPI_TOKEN;
  const date = (req.query.date || '').toString();
  const url = new URL('https://v3.alapi.cn/api/lunar');
  url.searchParams.set('token', token);
  if (date) url.searchParams.set('date', date);
  const r = await fetch(url.toString());
  const data = await r.json();
  res.status(r.status).json(data);
}