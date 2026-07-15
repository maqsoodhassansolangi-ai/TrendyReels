// ============================================
// TrendyReels Bots - Cloudflare Workers
// ============================================
// Deploy each bot as a separate Cloudflare Worker

// ============================================
// Bot 1: YouTubeBot - Fetches Creative Commons videos
// ============================================
const YOUTUBE_API_KEY = 'AIzaSyA-jjRqRwtyqk5lR0yIrqH7yI0jlW0t3g4';

async function youtubeBot(request) {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('q') || 'trending';
    const maxResults = parseInt(url.searchParams.get('max')) || 10;
    
    try {
        // Search for Creative Commons licensed videos
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&maxResults=${maxResults}&videoLicense=creativeCommon&type=video&key=${YOUTUBE_API_KEY}`
        );
        
        if (!response.ok) throw new Error('YouTube API error');
        const data = await response.json();
        
        // Format results
        const videos = data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high.url,
            channel: item.snippet.channelTitle,
            embed_code: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${item.id.videoId}" frameborder="0" allowfullscreen></iframe>`,
            is_copyright_free: true,
            category: 'auto-detected',
            published: true
        }));
        
        return new Response(JSON.stringify({ success: true, videos }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ============================================
// Bot 2: PexelsBot - Fetches free stock videos
// ============================================
const PEXELS_API_KEY = 'YOUR_PEXELS_API_KEY'; // User needs to add their own key

async function pexelsBot(request) {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || 'nature';
    const perPage = parseInt(url.searchParams.get('per_page')) || 10;
    
    try {
        const response = await fetch(
            `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}`,
            {
                headers: {
                    'Authorization': PEXELS_API_KEY
                }
            }
        );
        
        if (!response.ok) throw new Error('Pexels API error');
        const data = await response.json();
        
        // Format results
        const videos = data.videos.map(video => ({
            id: video.id,
            title: video.user.name + ' - ' + query,
            description: `Free stock video from Pexels by ${video.user.name}`,
            thumbnail: video.image,
            embed_code: `<video controls src="${video.video_files[0].link}" poster="${video.image}"></video>`,
            is_copyright_free: true,
            category: 'stock',
            published: true
        }));
        
        return new Response(JSON.stringify({ success: true, videos }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// ============================================
// Bot 3: SafeVideoBot - SFW filter + broken embed checker + sitemap
// ============================================
async function safeVideoBot(request) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'check';
    
    if (action === 'sitemap') {
        // Generate sitemap
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
            <url>
                <loc>https://trendyreels.pages.dev/</loc>
                <changefreq>daily</changefreq>
                <priority>1.0</priority>
            </url>
            <url>
                <loc>https://trendyreels.pages.dev/about.html</loc>
                <changefreq>monthly</changefreq>
                <priority>0.5</priority>
            </url>
            <url>
                <loc>https://trendyreels.pages.dev/contact.html</loc>
                <changefreq>monthly</changefreq>
                <priority>0.5</priority>
            </url>
            <url>
                <loc>https://trendyreels.pages.dev/privacy.html</loc>
                <changefreq>yearly</changefreq>
                <priority>0.3</priority>
            </url>
            <url>
                <loc>https://trendyreels.pages.dev/dmca.html</loc>
                <changefreq>yearly</changefreq>
                <priority>0.3</priority>
            </url>
            <url>
                <loc>https://trendyreels.pages.dev/disclaimer.html</loc>
                <changefreq>yearly</changefreq>
                <priority>0.3</priority>
            </url>
        </urlset>`;
        
        return new Response(sitemap, {
            headers: { 'Content-Type': 'application/xml' }
        });
    }
    
    if (action === 'check-embed') {
        const embedUrl = url.searchParams.get('url');
        if (!embedUrl) {
            return new Response(JSON.stringify({ error: 'Missing url parameter' }), { status: 400 });
        }
        
        try {
            const response = await fetch(embedUrl, { method: 'HEAD' });
            const isValid = response.ok;
            return new Response(JSON.stringify({ valid: isValid, status: response.status }), {
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            return new Response(JSON.stringify({ valid: false, error: error.message }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    // SFW content filter
    if (action === 'filter') {
        const text = url.searchParams.get('text') || '';
        const unsafeWords = ['adult', 'porn', 'sex', 'xxx', '18+', 'nsfw'];
        const isSafe = !unsafeWords.some(word => text.toLowerCase().includes(word));
        
        return new Response(JSON.stringify({ safe: isSafe, text }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return new Response(JSON.stringify({ 
        message: 'SafeVideoBot is running. Available actions: sitemap, check-embed, filter' 
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// ============================================
// Worker Router
// ============================================
export default {
    async fetch(request) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        if (path === '/api/youtube-bot') {
            return youtubeBot(request);
        } else if (path === '/api/pexels-bot') {
            return pexelsBot(request);
        } else if (path === '/api/safe-bot') {
            return safeVideoBot(request);
        }
        
        return new Response('Bot API endpoints: /api/youtube-bot, /api/pexels-bot, /api/safe-bot', {
            status: 404
        });
    }
};
