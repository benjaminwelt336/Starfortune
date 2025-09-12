export const runtime = 'edge';

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);

  const date = searchParams.get('date') || '';
  const base = process.env.ALAPI_BASE || 'https://v3.alapi.cn';
  const token = process.env.ALAPI_TOKEN || '';

  const url = new URL('/api/lunar', base);
  if (date) url.searchParams.set('date', date);
  if (token) url.searchParams.set('token', token);

  const upstream = await fetch(url.toString(), { cache: 'no-store' });
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}
