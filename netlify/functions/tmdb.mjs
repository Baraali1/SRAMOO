export default async (request) => {
  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  const apiKey = process.env.TMDB_API_KEY;

  if (!path) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'TMDB API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  // Build TMDB URL - preserve query params from original request
  const tmdbUrl = new URL(`https://api.themoviedb.org/3/${path}`);
  // Copy query params except 'path'
  url.searchParams.forEach((value, key) => {
    if (key !== 'path') tmdbUrl.searchParams.set(key, value);
  });
  tmdbUrl.searchParams.set('api_key', apiKey);

  try {
    const res = await fetch(tmdbUrl.toString());
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'TMDB proxy failed', detail: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};

export const config = {
  path: "/api/tmdb-proxy",
  method: "GET"
};
