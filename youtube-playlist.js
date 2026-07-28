// ✅ Cloudflare Pages Function — YouTube Playlist / Channel Import (Admin کے لیے)
// یوزر ایک playlist لنک یا channel لنک بھیجتا ہے، یہ فنکشن اس کی تمام ویڈیوز واپس لاتا ہے۔
// API key ہمیشہ سرور پر ہی رہتی ہے (env.YOUTUBE_API_KEY) — کبھی بھی براؤزر تک نہیں جاتی۔

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const inputUrl = url.searchParams.get('url');
    const maxResults = Math.min(parseInt(url.searchParams.get('max') || '25'), 200); // ✅ حفاظتی حد: زیادہ سے زیادہ 200

    if (!inputUrl) {
        return jsonResponse({ error: 'Missing url parameter' }, 400);
    }

    const apiKey = env.YOUTUBE_API_KEY;
    if (!apiKey) {
        return jsonResponse({ error: 'Server not configured: YOUTUBE_API_KEY missing' }, 500);
    }

    try {
        // ✅ مرحلہ 1: لنک کی قسم پہچانیں (Playlist یا Channel)
        let playlistId = null;
        let sourceLabel = '';

        const listMatch = inputUrl.match(/[?&]list=([a-zA-Z0-9_-]+)/);
        if (listMatch) {
            // ✅ سیدھا Playlist لنک ملا (یا watch?v=...&list=... بھی چل جائے گا)
            playlistId = listMatch[1];
            sourceLabel = 'playlist';
        } else {
            // ✅ Channel لنک — پہلے اصل Channel ID تک پہنچنا ضروری ہے، پھر اس کی خودکار "Uploads" playlist نکالنی ہوگی
            const channelId = await resolveChannelId(inputUrl, apiKey);
            if (!channelId) {
                return jsonResponse({ error: 'یہ نہ Playlist لنک ہے نہ پہچانا جانے والا Channel لنک۔ صحیح YouTube لنک پیسٹ کریں۔' }, 400);
            }
            const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails,snippet&id=${channelId}&key=${apiKey}`);
            const chJson = await chRes.json();
            const uploadsId = chJson.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
            if (!uploadsId) {
                return jsonResponse({ error: 'Channel کی Uploads playlist نہیں ملی۔' }, 404);
            }
            playlistId = uploadsId;
            sourceLabel = 'channel';
        }

        // ✅ مرحلہ 2: اس playlist کی ویڈیوز pagination کے ساتھ لائیں، جب تک maxResults پورا نہ ہو
        let items = [];
        let pageToken = '';
        do {
            const plUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}${pageToken ? `&pageToken=${pageToken}` : ''}&key=${apiKey}`;
            const plRes = await fetch(plUrl);
            const plJson = await plRes.json();
            if (plJson.error) return jsonResponse({ error: plJson.error.message || 'YouTube API error' }, plRes.status);

            const pageItems = (plJson.items || [])
                .filter(it => it.snippet && it.snippet.resourceId && it.snippet.resourceId.videoId && it.snippet.title !== 'Deleted video' && it.snippet.title !== 'Private video')
                .map(it => ({
                    id: it.snippet.resourceId.videoId,
                    title: it.snippet.title,
                    thumbnail: it.snippet.thumbnails?.high?.url || it.snippet.thumbnails?.default?.url || '',
                    channel: it.snippet.videoOwnerChannelTitle || it.snippet.channelTitle || ''
                }));
            items = items.concat(pageItems);
            pageToken = plJson.nextPageToken || '';
        } while (pageToken && items.length < maxResults);

        items = items.slice(0, maxResults);

        return jsonResponse({ items, source: sourceLabel, playlistId, count: items.length });
    } catch (e) {
        return jsonResponse({ error: 'YouTube Playlist/Channel request failed: ' + e.message }, 502);
    }
}

// ✅ مختلف قسم کے Channel لنکس (UC ID / @handle / /c/name / /user/name) کو اصل Channel ID میں بدلنا
async function resolveChannelId(inputUrl, apiKey) {
    // شکل 1: /channel/UCxxxxxxxx — یہ پہلے سے اصل ID ہے، سیدھا استعمال کریں
    const directMatch = inputUrl.match(/\/channel\/(UC[a-zA-Z0-9_-]{10,})/);
    if (directMatch) return directMatch[1];

    // شکل 2: /@handle
    const handleMatch = inputUrl.match(/\/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch) {
        const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=@${handleMatch[1]}&key=${apiKey}`);
        const json = await res.json();
        if (json.items?.[0]?.id) return json.items[0].id;
    }

    // شکل 3: /c/customName یا /user/legacyUsername
    const nameMatch = inputUrl.match(/\/(?:c|user)\/([a-zA-Z0-9_.-]+)/);
    if (nameMatch) {
        // پہلے پرانے forUsername سے کوشش (صرف legacy usernames پر کام کرتا ہے)
        const res1 = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${nameMatch[1]}&key=${apiKey}`);
        const json1 = await res1.json();
        if (json1.items?.[0]?.id) return json1.items[0].id;
    }

    // شکل 4: کچھ نہ ملے تو آخری کوشش — YouTube Search کے ذریعے (نام سے channel ڈھونڈنا)
    const fallbackName = (handleMatch && handleMatch[1]) || (nameMatch && nameMatch[1]);
    if (fallbackName) {
        const res2 = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(fallbackName)}&maxResults=1&key=${apiKey}`);
        const json2 = await res2.json();
        if (json2.items?.[0]?.snippet?.channelId) return json2.items[0].snippet.channelId;
        if (json2.items?.[0]?.id?.channelId) return json2.items[0].id.channelId;
    }

    return null;
}

function jsonResponse(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}
