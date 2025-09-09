export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const token = process.env.ALAPI_TOKEN;
  const star = (req.query.star || '').toString().trim();
  const url = new URL('https://v3.alapi.cn/api/star');
  url.searchParams.set('token', token);
  if (star) url.searchParams.set('star', star);
  const r = await fetch(url.toString());
  const data = await r.json();
  res.status(r.status).json(data);
}