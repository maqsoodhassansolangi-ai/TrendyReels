// ✅ Cloudflare Pages Function — چیک کریں Bunny پر ویڈیو کی encoding مکمل ہوئی یا نہیں، اور اس کا HLS لنک دیں
export async function onRequestGet(context) {
    const { request, env } = context;
    const libraryId = env.BUNNY_LIBRARY_ID;
    const apiKey = env.BUNNY_STREAM_API_KEY;
    const pullZone = env.BUNNY_PULL_ZONE_HOSTNAME;

    if (!libraryId || !apiKey || !pullZone) {
        return new Response(JSON.stringify({ error: 'Server not configured: Bunny environment variables missing' }), {
            status: 500, headers: { 'Content-Type': 'application/json' }
        });
    }

    const url = new URL(request.url);
    const videoId = url.searchParams.get('id');
    if (!videoId) {
        return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
            headers: { 'AccessKey': apiKey, 'accept': 'application/json' }
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            return new Response(JSON.stringify({ error: 'Bunny status check failed', detail: data }), { status: res.status, headers: { 'Content-Type': 'application/json' } });
        }
        // ✅ Bunny کا status نمبر: 0=Created,1=Uploaded,2=Processing,3=Transcoding,4=Finished,5=Error،
        // (Bunny اپنے dashboard پر یہ نمبر بدل بھی سکتا ہے — پہلی بار test کر کے تصدیق کر لیں، اسی لیے raw بھی ساتھ بھیج رہے ہیں)
        const ready = data.status === 4;
        const failed = data.status === 5;
        return new Response(JSON.stringify({
            ready,
            failed,
            status: data.status,
            hlsUrl: ready ? `https://${pullZone}/${videoId}/playlist.m3u8` : null,
            thumbnailUrl: `https://${pullZone}/${videoId}/thumbnail.jpg`,
            raw: data
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Bunny API request failed', message: e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
    }
}
