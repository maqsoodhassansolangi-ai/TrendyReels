// ✅ Cloudflare Pages Function — YouTube ویڈیو کی معلومات (title وغیرہ) محفوظ طریقے سے لانا
// یہ سرور کی طرف چلتا ہے، اس لیے YOUTUBE_API_KEY کبھی بھی صارف کے browser تک نہیں جاتی
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id parameter' }), {
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

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(id)}&part=snippet&key=${apiKey}`;

    try {
        const res = await fetch(apiUrl);
        const data = await res.json();
        return new Response(JSON.stringify(data), {
            status: res.status,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'YouTube API request failed' }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
