// ✅ Cloudflare Pages Function — کسی موجودہ ویڈیو URL کو Bunny Stream کو دیں تاکہ وہ خود fetch/encode کر لے
// API key اور Library ID سرور پر (environment variables) محفوظ رہتی ہیں، browser تک کبھی نہیں جاتیں
export async function onRequestPost(context) {
    const { request, env } = context;
    const libraryId = env.BUNNY_LIBRARY_ID;
    const apiKey = env.BUNNY_STREAM_API_KEY;

    if (!libraryId || !apiKey) {
        return new Response(JSON.stringify({ error: 'Server not configured: BUNNY_LIBRARY_ID/BUNNY_STREAM_API_KEY missing' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    let body;
    try { body = await request.json(); } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const sourceUrl = body.url;
    const title = body.title || 'Untitled';
    if (!sourceUrl) {
        return new Response(JSON.stringify({ error: 'Missing url' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/fetch`, {
            method: 'POST',
            headers: { 'AccessKey': apiKey, 'Content-Type': 'application/json', 'accept': 'application/json' },
            body: JSON.stringify({ url: sourceUrl, title })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return new Response(JSON.stringify({ error: 'Bunny fetch failed', detail: data }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
        }
        // ✅ Bunny کے جواب میں ویڈیو کا شناختی نمبر عام طور پر 'guid' کہلاتا ہے — احتیاطاً متبادل ناموں کو بھی دیکھ لیں
        const videoId = data.guid || data.videoId || data.id || null;
        return new Response(JSON.stringify({ videoId, raw: data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Bunny API request failed', message: e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
}
