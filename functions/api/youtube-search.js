// ✅ Cloudflare Pages Function — YouTube Search (Admin Bot کے لیے)، API key سرور پر محفوظ رہتی ہے
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    const maxResults = url.searchParams.get('maxResults') || '10';
    const licenseFilter = url.searchParams.get('licenseFilter') || ''; // مثلاً '&videoLicense=creativeCommon'

    if (!q) {
        return new Response(JSON.stringify({ error: 'Missing q parameter' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const apiKey = env.YOUTUBE_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ error: 'Server not configured: YOUTUBE_API_KEY missing' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&maxResults=${encodeURIComponent(maxResults)}&type=video${licenseFilter}&key=${apiKey}`;

    try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        return new Response(JSON.stringify(data), {
            status: res.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'YouTube API request failed' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
