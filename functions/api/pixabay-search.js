// ✅ Cloudflare Pages Function — Pixabay Video Search (Admin Bot کے لیے)، API key سرور پر محفوظ رہتی ہے
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    const perPage = url.searchParams.get('per_page') || '10';

    if (!q) {
        return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const apiKey = env.PIXABAY_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Server not configured: PIXABAY_API_KEY missing' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const apiUrl = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(q)}&per_page=${encodeURIComponent(perPage)}`;

    try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        return new Response(JSON.stringify(data), {
            status: res.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Pixabay API request failed' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
