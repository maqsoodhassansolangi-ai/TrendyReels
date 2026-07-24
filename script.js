// ============================================
// TrendyReels - V3.4.1 (COMPLETE FINAL VERSION) - PART 1
// ============================================

const SUPABASE_URL = 'https://tdbuvlyzgxdkmheocikf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xBiU1V-ZZxLkNF-Yw6dV5A_JEdF4Uig';

// ✅ مکمل طور پر یکجا شدہ اور مضبوط Supabase Wrapper
const supabase = {
    async query(endpoint, options = {}) {
        const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
        // ✅ اگر admin login ہے تو اس کا اصل token بھیجیں (RLS کے تحت صرف تب لکھنے کی اجازت ملے گی)
        const authToken = (typeof getAdminToken === 'function' && getAdminToken()) || SUPABASE_ANON_KEY;
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            ...options.headers
        };
        try {
            const response = await fetch(url, { ...options, headers });
            if (response.status === 204) return null;
            const text = await response.text();
            if (!text) return null;
            const data = JSON.parse(text);
            if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
            return data;
        } catch (error) { throw error; }
    },

    from(table) {
        return {
            queryUrl: `${SUPABASE_URL}/rest/v1/${table}`,
            select: function(cols = '*') { this.queryUrl += `?select=${cols}`; return this; },
            ilike: function(col, val) { this.queryUrl += `&${col}=ilike.*${encodeURIComponent(val)}*`; return this; },
            maybeSingle: async function() {
                const authToken = (typeof getAdminToken === 'function' && getAdminToken()) || SUPABASE_ANON_KEY;
                const res = await fetch(this.queryUrl, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${authToken}` } });
                const data = await res.json();
                return { data: (data && data.length > 0) ? data[0] : null, error: null };
            },
            upsert: async function(data, opts = {}) {
                // ✅ onConflict کالم کو query string میں شامل کریں ورنہ merge-duplicates کام نہیں کرتا
                const conflictCol = opts.onConflict || 'id';
                const endpoint = `${table}?on_conflict=${encodeURIComponent(conflictCol)}`;
                const result = await supabase.query(endpoint, { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(data) });
                return { data: result, error: null }; // ✅ نتیجہ کو آبجیکٹ میں لپیٹ کر واپس کریں
            },
            insert: async function(data) { 
                const result = await supabase.query(table, { method: 'POST', body: JSON.stringify(data) });
                return { data: result, error: null }; // ✅ نتیجہ کو آبجیکٹ میں لپیٹ کر واپس کریں
            }
        };
    },
    async get(endpoint, params = {}) { const query = new URLSearchParams(params).toString(); return this.query(`${endpoint}?${query}`); },
    async post(endpoint, data) { return this.query(endpoint, { method: 'POST', body: JSON.stringify(data) }); },
    async patch(endpoint, data, id) { return this.query(`${endpoint}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) }); },
    async delete(endpoint, id) { return this.query(`${endpoint}?id=eq.${id}`, { method: 'DELETE' }); },
    // ✅ Postgres function کال کرنے کے لیے (مثلاً like بڑھانا/گھٹانا)
    async rpc(fnName, params = {}) {
        const result = await this.query(`rpc/${fnName}`, { method: 'POST', body: JSON.stringify(params) });
        return { data: result, error: null };
    }
};

let state = {
    videos: [],
    categories: [],
    adSlots: [],
    currentCategory: 'all',
    searchQuery: '',
    darkMode: localStorage.getItem('trendyreels-theme') === 'dark',
    currentVideo: null,
    pendingVideos: []
};

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function applyTheme() {
    if (state.darkMode) {
        document.body.classList.add('dark-mode');
        const themeToggle = $('#themeToggle');
        if (themeToggle) themeToggle.textContent = '☀️';
        const adminThemeToggle = $('#adminThemeToggle');
        if (adminThemeToggle) adminThemeToggle.textContent = '☀️';
        const adminThemeSwitch = $('#adminThemeSwitch');
        if (adminThemeSwitch) adminThemeSwitch.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        const themeToggle = $('#themeToggle');
        if (themeToggle) themeToggle.textContent = '🌙';
        const adminThemeToggle = $('#adminThemeToggle');
        if (adminThemeToggle) adminThemeToggle.textContent = '🌙';
        const adminThemeSwitch = $('#adminThemeSwitch');
        if (adminThemeSwitch) adminThemeSwitch.checked = false;
    }
    localStorage.setItem('trendyreels-theme', state.darkMode ? 'dark' : 'light');
}

function toggleTheme() {
    state.darkMode = !state.darkMode;
    applyTheme();
}

async function loadCategories() {
    try {
        const data = await supabase.get('categories');
        state.categories = data || [];
        renderCategories();
        return data;
    } catch (error) {
        console.error('Error loading categories:', error);
        return [];
    }
}

function renderCategories() {
    const container = document.querySelector('.category-scroll');
    if (!container) return;
    const allBtn = container.querySelector('.category-pill[data-category="all"]');
    container.innerHTML = '';
    container.appendChild(allBtn);
    state.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-pill';
        btn.dataset.category = cat.name.toLowerCase();
        btn.textContent = cat.name;
        container.appendChild(btn);
    });
    container.querySelectorAll('.category-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentCategory = btn.dataset.category;
            renderVideos();
        });
    });
    const select = $('#videoCategory');
    if (select) {
        select.innerHTML = '<option value="">Select Category</option>';
        state.categories.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat.name;
            opt.textContent = cat.name;
            select.appendChild(opt);
        });
    }
}

async function loadVideos() {
    try {
        const data = await supabase.get('videos', { select: '*', order: 'created_at.desc' });
        state.videos = data || [];
        renderVideos();
        renderAdminVideos();
        return data;
    } catch (error) {
        console.error('Error loading videos:', error);
        return [];
    }
}

function renderVideos() {
    const grid = $('#videoGrid');
    if (!grid) return;
    let filtered = state.videos;
    if (state.currentCategory !== 'all') {
        filtered = filtered.filter(v => v.category && v.category.toLowerCase() === state.currentCategory);
    }
    if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter(v => v.title && v.title.toLowerCase().includes(q));
    }
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p>No videos found</p></div>`;
        return;
    }
    grid.innerHTML = filtered.map(video => {
        const isNativeVideo = video.embed_code.trim().startsWith('<video');
        let mediaHtml = '';
        if (isNativeVideo) {
            const srcMatch = video.embed_code.match(/src="([^"]+)"/);
            const videoSrc = srcMatch ? srcMatch[1] : '';
            mediaHtml = `<video class="video-thumbnail" src="${videoSrc}" preload="metadata" muted playsinline></video>`;
        } else {
            mediaHtml = `<img class="video-thumbnail" src="${getThumbnail(video.embed_code)}" alt="${video.title || 'Video'}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22><rect fill=%22%23CCCCCC%22 width=%22320%22 height=%22180%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23666%22 font-size=%2220%22>No Thumbnail</text></svg>'">`;
        }
        return `<div class="video-card" data-id="${video.id}">${mediaHtml}<div class="video-info"><div class="video-title">${video.title || 'Untitled Video'}</div><div class="video-meta"><span class="video-category">${video.category || 'Uncategorized'}</span>${video.is_copyright_free ? '<span class="copyright-badge">© Free</span>' : ''}</div></div></div>`;
    }).join('');
    grid.querySelectorAll('.video-card').forEach(card => {
        card.addEventListener('click', () => {
            const id = parseInt(card.dataset.id);
            const video = state.videos.find(v => v.id === id);
            if (video) openModernVideoModal(video);
        });
    });
}

function getThumbnail(embedCode) {
    if (!embedCode) return '';
    const ytMatch = embedCode.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    const dmMatch = embedCode.match(/dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/);
    if (dmMatch) return `https://www.dailymotion.com/thumbnail/video/${dmMatch[1]}`;
    const posterMatch = embedCode.match(/poster=\s*[\"'\\]*([^\"'>\s\\]+)/i);
    if (posterMatch) return posterMatch[1].replace(/[\"'\\]/g, '');
    return '';
}

function extractEmbedUrl(embedCode) {
    const ytMatch = embedCode.match(/src="([^"]+youtube\.com\/embed\/[^"]+)"/);
    if (ytMatch) return ytMatch[1];
    const dmMatch = embedCode.match(/src="([^"]+dailymotion\.com\/embed\/[^"]+)"/);
    if (dmMatch) return dmMatch[1];
    return embedCode.trim();
}

// ✅ Back Button Fix: modal کھلنے پر ایک virtual history entry شامل کریں
let modalHistoryPushed = false;
function openModalHistoryGuard() {
    if (!modalHistoryPushed) {
        history.pushState({ trendyReelsModal: true }, '');
        modalHistoryPushed = true;
    }
}

function closeVideoModal(fromPopstate = false) {
    $('#videoModal').classList.remove('active');
    $('#videoPlayer').innerHTML = '';
    if (typeof stopActiveUniversalPlayer === 'function') stopActiveUniversalPlayer(); // ✅ YouTube/Dailymotion پلیئر بھی روک دیں
    if (modalHistoryPushed) {
        modalHistoryPushed = false;
        // ✅ اگر یہ Back بٹن سے نہیں بلکہ X/باہر کلک/Escape سے بند ہوا تو ہمارا اضافی history entry بھی صاف کر دیں
        if (!fromPopstate) history.back();
    }
}

// ✅ موبائل کا Back بٹن دبانے پر — صفحہ/ٹیب چھوڑنے کے بجائے صرف پلیئر/ریلز بند کریں
window.addEventListener('popstate', function() {
    const modal = $('#videoModal');
    if (modal && modal.classList.contains('active')) {
        closeVideoModal(true);
        return;
    }
    const reelsView = $('#reelsView');
    if (reelsView && reelsView.classList.contains('active') && typeof closeReelsView === 'function') {
        closeReelsView(true);
    }
});

function renderAdminVideos() {
    const tbody = $('#adminVideoTableBody');
    if (!tbody) return;
    
    if (state.videos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:30px;">No videos added yet</td></tr>`;
        return;
    }

    tbody.innerHTML = state.videos.map(video => {
        // اگر تھمبنیل نہیں ہے تو فوراً بنا لیں
        let thumbSrc = video.thumbnail || getThumbnail(video.embed_code);
        // اگر تھمبنیل نہیں بن رہا تو ایک ڈیفالٹ امیج دکھائیں
        if (!thumbSrc) thumbSrc = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="50" height="30"><rect fill="%23ddd"/></svg>';

        return `
        <tr>
            <td><input type="checkbox" class="video-checkbox" data-id="${video.id}"></td>
            <td>
                <!-- ✅ چھوٹا تھمبنیل -->
                <img src="${thumbSrc}" style="width:50px; height:30px; object-fit:cover; border-radius:4px;" onerror="this.src='data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'50\' height=\'30\'><rect fill=\'%23ddd\'/></svg>'">
            </td>
            <td>${video.title || 'Untitled'}</td>
            <td>${video.category || 'Uncategorized'}</td>
            <td>${video.embed_code ? '✅' : '❌'}</td>
            <td>${video.is_copyright_free ? '✅ Free' : '❌ Restricted'}</td>
            <td style="text-align:center;"><button class="reel-toggle-btn" onclick="toggleReelStatus(${video.id}, ${video.is_reel ? 'true' : 'false'})" title="${video.is_reel ? 'Reel ہے، ہٹانے کے لیے کلک کریں' : 'Reel بنانے کے لیے کلک کریں'}" style="background:${video.is_reel ? '#4CAF50' : '#ccc'}; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer;">${video.is_reel ? '🎬 Reel' : '➖'}</button></td>
            <td>${video.published ? '✅ Published' : '⏳ Draft'}</td>
            <td class="actions-cell"><button class="delete-btn" onclick="deleteVideo(${video.id})">🗑</button></td>
        </tr>
        `;
    }).join('');

    const countEl = $('#totalVideosCount');
    if (countEl) countEl.textContent = state.videos.length;

    // ✅ خود بخود تھمبنیلز کو ڈیٹا بیس میں سیو کرنا
    state.videos.forEach(async (video) => {
        if (!video.thumbnail) {
            const thumb = getThumbnail(video.embed_code);
            if (thumb) {
                try {
                    await supabase.patch('videos', { thumbnail: thumb }, video.id);
                } catch (e) {
                    console.warn('Failed to save thumbnail:', e);
                }
            }
        }
    });
}

async function deleteVideo(id) {
    if (!confirm('Delete this video?')) return;
    try { await supabase.delete('videos', id); await loadVideos(); } 
    catch (error) { alert('Failed to delete video'); }
}

// ✅ Reels فیچر: ایک کلک سے کسی ویڈیو کو Reel بنانا/ہٹانا
async function toggleReelStatus(id, currentStatus) {
    try {
        await supabase.patch('videos', { is_reel: !currentStatus }, id);
        await loadVideos();
    } catch (error) { alert('Reel status بدلنے میں مسئلہ: ' + error.message); }
}

// ✅ Bulk: منتخب ویڈیوز کو ایک ساتھ Reel بنانا
async function bulkMarkAsReel() {
    const selected = document.querySelectorAll('.video-checkbox:checked');
    if (selected.length === 0) { alert('پہلے ویڈیوز منتخب کریں۔'); return; }
    const ids = Array.from(selected).map(cb => parseInt(cb.dataset.id));
    if (!confirm(`${ids.length} ویڈیوز کو Reel بنائیں؟`)) return;
    try {
        for (const id of ids) await supabase.patch('videos', { is_reel: true }, id);
        await loadVideos();
        alert(`✅ ${ids.length} ویڈیوز اب Reels ہیں۔`);
    } catch (error) { alert('❌ Error: ' + error.message); }
}

async function addVideo(formData) {
    try {
        const embedCode = formData.get('embed');
        const category = formData.get('category');
        const isCopyrightFree = formData.get('copyrightFree') === 'on';
        const isReel = formData.get('isReel') === 'on'; // ✅ Reels فیچر
        let title = 'Video'; // آپ کی موجودہ لائ
        const ytMatch = embedCode.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
            try {
                const resp = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${ytMatch[1]}&part=snippet&key=AIzaSyA-jjRqRwtyqk5lR0yIrqH7yI0jlW0t3g4`);
                const data = await resp.json();
                if (data.items?.[0]) title = data.items[0].snippet.title;
            } catch (e) {}
        }
        // ✅ Admin کی منتخب کردہ category استعمال کریں؛ صرف خالی/غیر منتخب ہونے پر auto-suggest سے fallback لیں
        const finalCategory = (category && category.trim()) ? category.trim() : autoSuggestCategory(title);
await supabase.post('videos', { 
    title, 
    embed_code: embedCode, 
    category: finalCategory,
    is_copyright_free: isCopyrightFree, 
    is_reel: isReel, // ✅ Reels فیچر
    published: true,
description: autoGenerateDescription(title),
tags: autoGenerateTags(title, finalCategory)
});
        await loadVideos();
        return true;
    } catch (error) { return false; }
}

async function bulkPublish() {
    if (!confirm('Publish all videos?')) return;
    try { for (const video of state.videos) await supabase.patch('videos', { published: true }, video.id); await loadVideos(); } 
    catch (error) { alert('Failed to publish all videos'); }
}

async function bulkDelete() {
    const selected = document.querySelectorAll('.video-checkbox:checked');
    if (selected.length === 0) { alert('No videos selected.'); return; }
    const ids = Array.from(selected).map(cb => parseInt(cb.dataset.id));
    if (!confirm(`Delete ${ids.length} selected video(s)?`)) return;
    try { for (const id of ids) await supabase.delete('videos', id); await loadVideos(); alert(`✅ ${ids.length} video(s) deleted.`); } 
    catch (error) { alert(`❌ Error: ${error.message}`); }
              }

// ============================================
// TrendyReels - V3.4.1 (COMPLETE FINAL VERSION) - PART 2
// ============================================

// --- Auto-Detect Copyright ---
function autoDetectCopyright(title, channel) {
    const freeKeywords = ['copyright free','no copyright','nocopyright','creative commons','cc0','royalty free','free use','public domain','ncs','ncs release'];
    const text = (title + ' ' + channel).toLowerCase();
    for (const keyword of freeKeywords) {
        if (text.includes(keyword)) return true;
    }
    return false;
}

// --- YouTube Bot ---
async function runYoutubeBot() {
    const categoryInput = prompt(`Select Category:`, 'Technology');
    if (!categoryInput) return;
    const keyword = prompt(`Enter YouTube keyword:`, 'cricket');
    if (!keyword) return;
    const count = parseInt(prompt('How many? (1-30):', '10')) || 10;
    const filterChoice = prompt(`Filter:\n1=Free\n2=Copyrighted\n3=Mixed`, '3');
    let licenseFilter = '';
    if (filterChoice === '1') licenseFilter = '&videoLicense=creativeCommon';
    else if (filterChoice === '2') licenseFilter = '&videoLicense=any';
    const apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&maxResults=${count}&type=video${licenseFilter}&key=AIzaSyA-jjRqRwtyqk5lR0yIrqH7yI0jlW0t3g4`;
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('YouTube API error');
        const json = await res.json();
        const videos = json.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            thumbnail: item.snippet.thumbnails.high.url,
            embed_code: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${item.id.videoId}" frameborder="0" allowfullscreen></iframe>`,
            channel: item.snippet.channelTitle,
            is_copyright_free: filterChoice === '1' ? true : autoDetectCopyright(item.snippet.title, item.snippet.channelTitle)
        }));
        if (videos.length > 0) showReviewPanel(videos, categoryInput);
    } catch (error) { alert(`❌ YouTube Error: ${error.message}`); }
}

async function runPixabayBot() {
    const categoryInput = prompt(`Select Category:`, 'Technology');
    if (!categoryInput) return;
    const keyword = prompt(`Enter Pixabay keyword:`, 'nature');
    if (!keyword) return;
    const count = parseInt(prompt('How many? (1-30):', '10')) || 10;
    const apiUrl = `https://pixabay.com/api/videos/?key=56707588-7f7c040c1e2ca5ef1b417bc38&q=${encodeURIComponent(keyword)}&per_page=${count}`;
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('Pixabay API error');
        const json = await res.json();
        if (!json.hits || json.hits.length === 0) { alert('No videos found'); return; }
        const videos = json.hits.map(v => ({
            id: v.id,
            title: v.tags || 'Pixabay Video',
            thumbnail: v.videos.large.thumbnail || v.videos.tiny.thumbnail || v.webformatURL || v.previewURL || v.image,
            embed_code: `<video src="${v.videos.large.url || v.videos.tiny.url}" poster="${v.videos.large.thumbnail || v.videos.tiny.thumbnail || v.webformatURL || v.previewURL || v.image}"></video>`,
            channel: v.user || 'Pixabay',
            is_copyright_free: true
        }));
        if (videos.length > 0) showReviewPanel(videos, categoryInput);
    } catch (error) { alert(`❌ Pixabay Error: ${error.message}`); }
}

async function runDailymotionBot() {
    const categoryInput = prompt(`Select Category:`, 'Technology');
    if (!categoryInput) return;
    const keyword = prompt(`Enter Dailymotion keyword:`, 'sports');
    if (!keyword) return;
    const count = parseInt(prompt('How many? (1-30):', '10')) || 10;
    const apiUrl = `https://api.dailymotion.com/videos?search=${encodeURIComponent(keyword)}&fields=id,title,thumbnail_url,embed_html&limit=${count}`;
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('Dailymotion API error');
        const json = await res.json();
        const videos = json.list.map(v => ({
            id: v.id,
            title: v.title,
            thumbnail: v.thumbnail_url,
            embed_code: v.embed_html,
            channel: 'Dailymotion',
            is_copyright_free: autoDetectCopyright(v.title, 'Dailymotion')
        }));
        if (videos.length > 0) showReviewPanel(videos, categoryInput);
    } catch (error) { alert(`❌ Dailymotion Error: ${error.message}`); }
}

// --- Ads Manager (8 Slots) ---
async function loadAdSlots() {
    try { const data = await supabase.get('ad_slots'); state.adSlots = data || []; renderAdSlots(); return data; } 
    catch (error) { console.error('Error loading ad slots:', error); return []; }
}

// --- ✅ Public Ad Display (یوزر کے سامنے ad slots دکھانا) ---
function injectAdHtml(container, html) {
    if (!container || !html) return;
    container.innerHTML = '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    Array.from(temp.childNodes).forEach(node => {
        if (node.tagName === 'SCRIPT') {
            // ✅ innerHTML سے شامل کیے گئے <script> ٹیگ خودکار نہیں چلتے، اس لیے انہیں دوبارہ بنا کر چلائیں
            const s = document.createElement('script');
            for (const attr of node.attributes) s.setAttribute(attr.name, attr.value);
            s.textContent = node.textContent;
            container.appendChild(s);
        } else {
            container.appendChild(node);
        }
    });
}

function showPopupAd(code) {
    if (document.getElementById('ad-popup-overlay') || sessionStorage.getItem('tr_popup_shown')) return;
    sessionStorage.setItem('tr_popup_shown', '1');
    const overlay = document.createElement('div');
    overlay.id = 'ad-popup-overlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:9999; display:flex; align-items:center; justify-content:center;';
    overlay.innerHTML = `<div style="position:relative; background:#fff; padding:14px; border-radius:8px; max-width:92vw; max-height:85vh; overflow:auto;"><button id="ad-popup-close" style="position:absolute; top:-14px; right:-14px; width:30px; height:30px; border-radius:50%; background:#000; color:#fff; border:none; cursor:pointer; font-size:16px;">✕</button><div id="ad-popup-content"></div></div>`;
    document.body.appendChild(overlay);
    injectAdHtml(document.getElementById('ad-popup-content'), code);
    document.getElementById('ad-popup-close').onclick = () => overlay.remove();
}

function showStickyAd(code) {
    if (document.getElementById('ad-sticky-bar')) return;
    const bar = document.createElement('div');
    bar.id = 'ad-sticky-bar';
    bar.style.cssText = 'position:fixed; bottom:0; left:0; right:0; z-index:9998; background:#fff; box-shadow:0 -2px 8px rgba(0,0,0,0.15); display:flex; align-items:center; justify-content:center; padding:6px 30px; min-height:40px;';
    bar.innerHTML = `<button id="ad-sticky-close" style="position:absolute; top:2px; right:6px; background:transparent; border:none; font-size:16px; cursor:pointer;">✕</button><div id="ad-sticky-content"></div>`;
    document.body.appendChild(bar);
    injectAdHtml(document.getElementById('ad-sticky-content'), code);
    document.getElementById('ad-sticky-close').onclick = () => bar.remove();
}

function renderPublicAds() {
    // ✅ یہ فنکشن صرف مین (public) صفحے پر چلے، ایڈمن پینل پر نہیں
    if (!document.getElementById('videoGrid')) return;
    if (!state.adSlots || state.adSlots.length === 0) return;
    const isMobile = window.innerWidth <= 768;
    state.adSlots.forEach(slot => {
        if (!slot.enabled) return;
        const code = isMobile ? slot.mobileCode : slot.desktopCode;
        if (!code || !code.trim()) return;

        if (slot.name === 'popup') { showPopupAd(code); return; }
        if (slot.name === 'sticky') { showStickyAd(code); return; }

        const container = document.querySelector(`[data-ad-slot="${slot.name}"]`);
        if (container) {
            container.style.display = 'block';
            injectAdHtml(container, code);
        }
    });
}

// ✅ Comments Moderation (Admin)
async function loadAdminComments() {
    const container = document.getElementById('adminCommentsList');
    if (!container) return;
    try {
        const comments = await supabase.get('comments', { order: 'created_at.desc', limit: '200' });
        if (!comments || comments.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px; color:#888;">ابھی کوئی comment نہیں۔</p>`;
            return;
        }
        container.innerHTML = `
            <table class="admin-table">
                <thead><tr><th>Video</th><th>Name</th><th>Comment</th><th>Date</th><th>Action</th></tr></thead>
                <tbody>
                    ${comments.map(c => {
                        const video = state.videos.find(v => v.id === c.video_id);
                        return `<tr>
                            <td>${video ? video.title : ('#' + c.video_id)}</td>
                            <td>${c.user_name || c.name || ''}</td>
                            <td style="max-width:280px; word-break:break-word;">${c.comment}</td>
                            <td>${new Date(c.created_at).toLocaleDateString()}</td>
                            <td><button onclick="deleteComment(${c.id})" class="btn-danger" style="padding:4px 10px;">🗑 Delete</button></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        container.innerHTML = `<p style="color:#d32f2f;">Comments لوڈ نہیں ہو سکے: ${error.message}</p>`;
    }
}

async function deleteComment(id) {
    if (!confirm('یہ comment حذف کریں؟')) return;
    try {
        await supabase.delete('comments', id);
        await loadAdminComments();
    } catch (error) { alert('❌ حذف نہیں ہو سکا: ' + error.message); }
}

function renderAdSlots() {
    const grid = $('#adSlotsGrid');
    if (!grid) return;
    const slotConfigs = [
        { name: 'header', label: 'Header', mobile: '320x50', desktop: '728x90' },
        { name: 'sidebar', label: 'Sidebar', mobile: '300x250', desktop: '300x250' },
        { name: 'video_top', label: 'Video Top', mobile: '320x50', desktop: '468x60' },
        { name: 'video_bottom', label: 'Video Bottom', mobile: '320x50', desktop: '468x60' },
        { name: 'footer', label: 'Footer', mobile: '320x50', desktop: '728x90' },
        { name: 'mobile', label: 'Mobile', mobile: '320x50', desktop: '-' },
        { name: 'popup', label: 'Pop-under', mobile: '300x250', desktop: '300x250' },
        { name: 'sticky', label: 'Sticky Bar', mobile: '160x300', desktop: '-' }
    ];
    const slots = slotConfigs.map(config => {
        const existing = state.adSlots.find(s => s.name === config.name);
        return { ...config, enabled: existing ? existing.enabled : false, mobileCode: existing ? existing.mobileCode || '' : '', desktopCode: existing ? existing.desktopCode || '' : '' };
    });
    grid.innerHTML = slots.map(slot => `
        <div class="ad-slot-card" data-name="${slot.name}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h3>${slot.label} Ad</h3>
                <label class="toggle-switch"><input type="checkbox" class="ad-toggle" ${slot.enabled ? 'checked' : ''}><span class="slider"></span></label>
            </div>
            <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">📱 Mobile: <strong>${slot.mobile}</strong> &nbsp;|&nbsp; 💻 Desktop: <strong>${slot.desktop}</strong></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div><label style="font-size:0.75rem; font-weight:bold;">📱 Mobile Code</label><textarea class="ad-code-mobile" rows="3">${slot.mobileCode}</textarea></div>
                <div><label style="font-size:0.75rem; font-weight:bold;">💻 Desktop Code</label><textarea class="ad-code-desktop" rows="3">${slot.desktopCode}</textarea></div>
            </div>
            <button class="btn-secondary save-ad-btn" style="margin-top:8px; width:100%;">💾 Save</button>
        </div>
    `).join('');
    grid.querySelectorAll('.save-ad-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.ad-slot-card');
            const name = card.dataset.name;
            const enabled = card.querySelector('.ad-toggle').checked;
            const mobileCode = card.querySelector('.ad-code-mobile').value;
            const desktopCode = card.querySelector('.ad-code-desktop').value;
            try {
                const existing = state.adSlots.find(s => s.name === name);
                if (existing) await supabase.patch('ad_slots', { enabled, mobileCode, desktopCode }, existing.id);
                else await supabase.post('ad_slots', { name, enabled, mobileCode, desktopCode });
                await loadAdSlots();
                alert(`✅ ${name} saved!`);
            } catch (error) { alert(`❌ Error: ${error.message}`); }
        });
    });
}

// --- Secret Admin ---
// --- Secret Admin (Long Press on Logo) ---
// ✅ نوٹ: یہ صرف ایک "چھپا ہوا شارٹ کٹ" ہے، اصل حفاظت admin.html کے login سسٹم میں ہے (نیچے initAdminGate دیکھیں)
let longPressTimer = null;

function initSecretAdmin() {
    const logo = document.querySelector('.logo');
    if (!logo) return;

    // Touch events (Mobile)
    logo.addEventListener('touchstart', function(e) {
        longPressTimer = setTimeout(() => {
            window.location.href = 'admin.html';
        }, 5500); // 5.5 seconds
    });

    logo.addEventListener('touchend', function(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    logo.addEventListener('touchmove', function(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    // Mouse events (Desktop)
    logo.addEventListener('mousedown', function(e) {
        longPressTimer = setTimeout(() => {
            window.location.href = 'admin.html';
        }, 5500);
    });

    logo.addEventListener('mouseup', function(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    logo.addEventListener('mouseleave', function(e) {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });
}
// ============================================
// TrendyReels - V3.4.1 (COMPLETE FINAL VERSION) - PART 3
// ============================================

function loadPapaParse() {
    return new Promise((resolve) => {
        if (window.Papa) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
    });
}

async function ensureCategory(categoryName) {
    if (!categoryName) return 'General';
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/categories?name=eq.${encodeURIComponent(categoryName)}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await response.json();
        if (data && data.length > 0) return data[0].name;

        const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/categories`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({ name: categoryName })
        });
        const newData = await insertResponse.json();
        return newData[0]?.name || 'General';
    } catch (error) {
        console.error('Error ensuring category:', error);
        return 'General';
    }
}

// ✅ UPDATED: Dry Run support added
function autoConvertUrlToEmbed(url) {
    if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
        const id = url.includes('youtu.be/') ? url.split('youtu.be/')[1]?.split('?')[0] : url.split('v=')[1]?.split('&')[0];
        return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${id}" frameborder="0" allowfullscreen></iframe>`;
    }
    if (url.includes('tiktok.com')) {
        return `<blockquote class="tiktok-embed" cite="${url}" data-video-id="${url.split('/video/')[1]?.split('?')[0]}"><section><a target="_blank" href="${url}">TikTok Video</a></section></blockquote><script async src="https://www.tiktok.com/embed.js"></script>`;
    }
    if (url.includes('instagram.com')) {
        return `<blockquote class="instagram-media" data-instgrm-permalink="${url}" data-instgrm-version="14"></blockquote><script async src="//www.instagram.com/embed.js"></script>`;
    }
    if (url.includes('twitter.com') || url.includes('x.com')) {
        return `<blockquote class="twitter-tweet"><a href="${url}">Tweet</a></blockquote><script async src="https://platform.twitter.com/widgets.js"></script>`;
    }
    if (url.includes('dailymotion.com')) {
        const id = url.split('/video/')[1]?.split('?')[0];
        return `<iframe width="560" height="315" src="https://www.dailymotion.com/embed/video/${id}" frameborder="0" allowfullscreen></iframe>`;
    }
    return `<video src="${url}" style="width:100%;"></video>`;
}

// ============================================
// TrendyReels - V3.4.1 (COMPLETE FINAL VERSION) - PART 4
// ============================================

let searchTimeout = null;
function handleSearch(query) {
    state.searchQuery = query;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderVideos(), 300);
          }

// ============================================
// TrendyReels - V3.4.1 (COMPLETE FINAL VERSION) - PART 5
// ============================================

async function init() {
    applyTheme();
    await loadCategories();
    await loadVideos();
    loadFilterDropdowns();
    // loadVideos کے اندر شامل کریں:
loadBulkCategoryDropdown();
    loadBulkDeleteDropdown();
    await loadAdSlots();
    renderPublicAds(); // ✅ یوزر کے سامنے ad slots دکھائیں
    if (document.getElementById('adminCommentsList')) loadAdminComments(); // ✅ ایڈمن پر comments لوڈ کریں
    initSecretAdmin();
    const searchInput = $('#searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
        $('#searchBtn').addEventListener('click', () => handleSearch(searchInput.value));
    }
    const themeToggle = $('#themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    const reelsBtn = $('#reelsBtn');
    const closeReelsBtn = $('#closeReelsBtn');
    if (reelsBtn) reelsBtn.addEventListener('click', () => { if (typeof openReelsView === 'function') openReelsView(); });
    if (closeReelsBtn) closeReelsBtn.addEventListener('click', () => { if (typeof closeReelsView === 'function') closeReelsView(); });
    const adminThemeToggle = $('#adminThemeToggle');
    if (adminThemeToggle) adminThemeToggle.addEventListener('click', toggleTheme);
    const adminThemeSwitch = $('#adminThemeSwitch');
    if (adminThemeSwitch) adminThemeSwitch.addEventListener('change', toggleTheme);
    const modal = $('#videoModal');
    if (modal) {
        $('.close-modal').addEventListener('click', closeVideoModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeVideoModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeVideoModal(); });
    }
    $$('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.admin-tab').forEach(t => t.classList.remove('active'));
            $$('.admin-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            $(`#${tab.dataset.tab}Tab`).classList.add('active');
        });
    });
    const addVideoBtn = $('#addVideoBtn');
    const addModal = $('#addVideoModal');
    if (addVideoBtn && addModal) {
        addVideoBtn.addEventListener('click', () => addModal.classList.add('active'));
        addModal.querySelector('.close-modal').addEventListener('click', () => addModal.classList.remove('active'));
        addModal.addEventListener('click', (e) => { if (e.target === addModal) addModal.classList.remove('active'); });
        $('#addVideoForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (await addVideo(new FormData(e.target))) {
                addModal.classList.remove('active');
                e.target.reset();
            } else alert('Failed to add video.');
        });
    }
    const bulkPublishBtn = $('#bulkPublishBtn');
    if (bulkPublishBtn) bulkPublishBtn.addEventListener('click', bulkPublish);
    const bulkMarkReelBtn = $('#bulkMarkReelBtn');
    if (bulkMarkReelBtn) bulkMarkReelBtn.addEventListener('click', bulkMarkAsReel);
    const bulkDeleteBtn = $('#bulkDeleteBtn');
    if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', bulkDelete);
    const selectAll = $('#selectAll');
    if (selectAll) {
        selectAll.addEventListener('change', () => {
            $$('.video-checkbox').forEach(cb => cb.checked = selectAll.checked);
        });
    }
    const fileInput = document.getElementById('bulkFileInput');
    const uploadBtn = document.getElementById('uploadBulkBtn');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => {
            const file = fileInput.files[0];
            handleBulkUpload(file);
        });
    }
    const botMap = [
        { id: 'runYoutubeBot', fn: runYoutubeBot },
        { id: 'runPixabayBot', fn: runPixabayBot },
        { id: 'runDailymotionBot', fn: runDailymotionBot }
    ];
    botMap.forEach(({ id, fn }) => {
        const btn = $(`#${id}`);
        if (btn) btn.addEventListener('click', fn);
    });
    const cleanerBtn = document.getElementById('processCleanerBtn');
if (cleanerBtn) cleanerBtn.addEventListener('click', handleCleanerFile);
    console.log('TrendyReels V3.4.1 (COMPLETE FINAL VERSION) initialized!');
}

if (document.readyState === 'loading') {
    // --- ✅ Admin Authentication (Supabase Auth - حقیقی login سسٹم) ---
function getAdminToken() { return localStorage.getItem('tr_admin_token'); }
function setAdminSession(accessToken, refreshToken) {
    localStorage.setItem('tr_admin_token', accessToken);
    localStorage.setItem('tr_admin_refresh_token', refreshToken || '');
}
function clearAdminSession() {
    localStorage.removeItem('tr_admin_token');
    localStorage.removeItem('tr_admin_refresh_token');
}

async function adminLogin(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'غلط ای میل یا پاس ورڈ');
    setAdminSession(data.access_token, data.refresh_token);
    return data;
}

function adminLogout() {
    clearAdminSession();
    window.location.href = 'index.html';
}

async function verifyAdminSession() {
    const token = getAdminToken();
    if (!token) return false;
    try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${token}` }
        });
        return res.ok;
    } catch (e) { return false; }
}

// ✅ صرف admin.html پر چلے: پہلے login تصدیق کریں، پھر ہی admin پینل دکھائیں
async function initAdminGate() {
    const loginScreen = document.getElementById('adminLoginScreen');
    const appContent = document.getElementById('adminAppContent');
    if (!loginScreen || !appContent) return;

    const valid = await verifyAdminSession();
    if (valid) {
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
        init();
    } else {
        clearAdminSession();
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }

    const loginForm = document.getElementById('adminLoginForm');
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPasswordInput').value;
            const errEl = document.getElementById('adminLoginError');
            errEl.textContent = '';
            try {
                await adminLogin(email, password);
                loginScreen.style.display = 'none';
                appContent.style.display = 'block';
                init();
            } catch (err) {
                errEl.textContent = '❌ ' + err.message;
            }
        });
    }
    if (logoutBtn) logoutBtn.addEventListener('click', adminLogout);
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('adminLoginScreen')) {
        initAdminGate(); // ✅ admin.html — پہلے login تصدیق ہو
    } else {
        init(); // عام صفحات (index.html وغیرہ) — کوئی گیٹ نہیں
    }
});
} else {
    init();
}

window.deleteVideo = deleteVideo;

// ============================================
// Admin Gallery + Global Search (Single Tab)
// ============================================

let gallerySearchQuery = '';
let galleryFilterCategory = 'all';

// Dropdown لوڈ کریں
function loadGalleryDropdowns() {
    const filterSelect = document.getElementById('galleryCategoryFilter');
    if (!filterSelect) return;
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">All Categories</option>';
    state.categories.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        filterSelect.appendChild(opt);
    });
    filterSelect.value = currentVal;
}

// گیلری رینڈر کریں
function renderAdminGallery() {
    const grid = document.getElementById('adminGalleryGrid');
    if (!grid) return;

    // فلٹر لگائیں
    let filtered = state.videos;
    if (galleryFilterCategory !== 'all') {
        filtered = filtered.filter(v => v.category === galleryFilterCategory);
    }
    if (gallerySearchQuery.trim()) {
        const q = gallerySearchQuery.toLowerCase();
        filtered = filtered.filter(v => {
            const titleMatch = (v.title || '').toLowerCase().includes(q);
            const urlMatch = (v.embed_code || '').toLowerCase().includes(q);
            return titleMatch || urlMatch;
        });
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:40px; color:#888;">No videos found.</div>`;
        return;
    }

    // کارڈز بنائیں
    grid.innerHTML = filtered.map(v => {
        const thumb = v.thumbnail || getThumbnail(v.embed_code) || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect fill="%23ddd"/></svg>';
        return `
            <div class="gallery-card" data-id="${v.id}" style="border:1px solid #ddd; border-radius:8px; overflow:hidden; background:white; position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                <img src="${thumb}" style="width:100%; height:120px; object-fit:cover;">
                <div style="padding:10px;">
                    <div style="font-weight:500; font-size:0.9rem; margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${v.title || 'Untitled'}</div>
                    <div style="font-size:0.75rem; color:#888;">${v.category || 'Uncategorized'}</div>
                </div>
                <div style="position:absolute; top:10px; right:10px;">
                    <button class="gallery-menu-btn" data-id="${v.id}" style="background:rgba(0,0,0,0.6); border:none; color:white; border-radius:50%; width:30px; height:30px; cursor:pointer; font-size:16px; line-height:30px; text-align:center;">⋯</button>
                    <div class="gallery-menu-options" data-id="${v.id}" style="display:none; position:absolute; right:0; top:35px; background:white; border:1px solid #ddd; border-radius:6px; box-shadow:0 4px 8px rgba(0,0,0,0.1); z-index:10; min-width:120px; overflow:hidden;">
                        <div class="gallery-option" data-action="delete" data-id="${v.id}" style="padding:8px 12px; cursor:pointer; font-size:0.85rem; border-bottom:1px solid #f0f0f0; color:#dc3545;">🗑 Delete</div>
                        <div class="gallery-option" data-action="changecat" data-id="${v.id}" style="padding:8px 12px; cursor:pointer; font-size:0.85rem;">📂 Change Category</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // "..." مینو کے ایونٹس
    document.querySelectorAll('.gallery-menu-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.dataset.id;
            const menu = document.querySelector(`.gallery-menu-options[data-id="${id}"]`);
            // باقی سب مینو چھپائیں
            document.querySelectorAll('.gallery-menu-options').forEach(el => el.style.display = 'none');
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        });
    });

    // مینو کے آپشنز کے ایونٹس
    document.querySelectorAll('.gallery-option').forEach(opt => {
        opt.addEventListener('click', async function() {
            const id = parseInt(this.dataset.id);
            const action = this.dataset.action;
            const menu = document.querySelector(`.gallery-menu-options[data-id="${id}"]`);
            if (menu) menu.style.display = 'none';

            if (action === 'delete') {
                if (confirm('Delete this video?')) {
                    await deleteVideo(id);
                    renderAdminGallery(); // گرڈ ریفریش کریں
                }
            } else if (action === 'changecat') {
                const currentVideo = state.videos.find(v => v.id === id);
                if (!currentVideo) return;
                const newCat = prompt(`Enter new category for "${currentVideo.title || 'Untitled'}":`, currentVideo.category || '');
                if (newCat && newCat.trim() !== '') {
                    await supabase.patch('videos', { category: newCat.trim() }, id);
                    await loadVideos();
                    renderAdminGallery();
                }
            }
        });
    });

    // اگر کہیں اور کلک کریں تو مینو بند ہو جائے
    document.addEventListener('click', () => {
        document.querySelectorAll('.gallery-menu-options').forEach(el => el.style.display = 'none');
    });
}

// سرچ اور فلٹر ہینڈل کریں
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('gallerySearchInput');
    const filterSelect = document.getElementById('galleryCategoryFilter');
    const searchBtn = document.getElementById('gallerySearchBtn');
    const resetBtn = document.getElementById('galleryResetBtn');

    function updateGallery() {
        gallerySearchQuery = searchInput ? searchInput.value : '';
        galleryFilterCategory = filterSelect ? filterSelect.value : 'all';
        renderAdminGallery();
    }

    if (searchInput) searchInput.addEventListener('input', updateGallery);
    if (filterSelect) filterSelect.addEventListener('change', updateGallery);
    if (searchBtn) searchBtn.addEventListener('click', updateGallery);
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (filterSelect) filterSelect.value = 'all';
            gallerySearchQuery = '';
            galleryFilterCategory = 'all';
            renderAdminGallery();
        });
    }
});

// جب Gallery ٹیب پر کلک ہو تو رینڈر اور لوڈ کریں
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            if (this.dataset.tab === 'gallery') {
                loadGalleryDropdowns();
                renderAdminGallery();
            }
        });
    });
});

// ============================================
// Backup & Restore (New Module - inside Settings)
// ============================================

// 1. Download Backup
document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadBackupBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            if (state.videos.length === 0) {
                alert('No videos to backup. Add some videos first!');
                return;
            }

            const data = {
                version: '3.7.0',
                timestamp: new Date().toISOString(),
                totalVideos: state.videos.length,
                videos: state.videos
            };

            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trendyreels_backup_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('✅ Backup downloaded successfully!');
        });
    }

    // 2. Restore Backup
    const restoreBtn = document.getElementById('restoreBackupBtn');
    const fileInput = document.getElementById('restoreFileInput');
    if (restoreBtn && fileInput) {
        restoreBtn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            if (!file) {
                alert('Please select a valid .json backup file first.');
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const backupData = JSON.parse(e.target.result);
                    
                    // Basic validation
                    if (!backupData.videos || !Array.isArray(backupData.videos)) {
                        throw new Error('Invalid backup file format.');
                    }

                    if (!confirm(`⚠️ This will DELETE all ${state.videos.length} current videos and restore ${backupData.videos.length} videos from the backup. Are you sure?`)) {
                        return;
                    }

                    // Step 1: Delete ALL current videos
                    let deletedCount = 0;
                    for (const v of state.videos) {
                        try {
                            await supabase.delete('videos', v.id);
                            deletedCount++;
                        } catch (e) {
                            console.warn('Failed to delete video:', e);
                        }
                    }

                    // Step 2: Insert backup videos
                    let insertedCount = 0;
                    for (const v of backupData.videos) {
                        try {
                            // Remove the ID so Supabase generates a new one
                            const { id, created_at, ...cleanVideo } = v;
                            await supabase.post('videos', cleanVideo);
                            insertedCount++;
                        } catch (e) {
                            console.warn('Failed to insert video:', e);
                        }
                    }

                    alert(`✅ Restore complete! Deleted ${deletedCount} old videos, inserted ${insertedCount} new videos.`);
                    fileInput.value = ''; // Clear input
                    await loadVideos(); // Refresh the list
                } catch (error) {
                    alert(`❌ Restore failed: ${error.message}`);
                }
            };
            reader.readAsText(file);
        });
    }
});

// ============================================
// Smart Filter Bot (New Module)
// ============================================

let filteredVideos = []; // فلٹر شدہ ویڈیوز کی عارضی لسٹ

function loadFilterDropdowns() {
    const catSelect = document.getElementById('filterCategory');
    const assignSelect = document.getElementById('assignFilteredCategorySelect');
    if (!catSelect) return;
    
    [catSelect, assignSelect].forEach(sel => {
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">All Categories</option>';
        state.categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
        sel.value = currentVal;
    });
}

function applySmartFilter() {
    const cat = document.getElementById('filterCategory').value;
    const keyword = document.getElementById('filterKeyword').value.toLowerCase().trim();
    const timeOpt = document.getElementById('filterTime').value;

    filteredVideos = state.videos.filter(v => {
        // کیٹیگری فلٹر
        if (cat && v.category !== cat) return false;
        // عنوان میں کلید لفظ
        if (keyword && !(v.title || '').toLowerCase().includes(keyword)) return false;
        // وقت کا فلٹر (دنوں میں)
        if (timeOpt) {
            const days = parseInt(timeOpt);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);
            const created = new Date(v.created_at);
            if (created > cutoff) return false;
        }
        return true;
    });

    renderFilteredPreview();
}

function renderFilteredPreview() {
    const container = document.getElementById('filterPreviewContainer');
    const grid = document.getElementById('filterPreviewGrid');
    const delBtn = document.getElementById('deleteFilteredBtn');
    const assignWrapper = document.getElementById('assignFilteredWrapper');

    if (filteredVideos.length === 0) {
        container.style.display = 'none';
        delBtn.style.display = 'none';
        assignWrapper.style.display = 'none';
        alert('No videos match your filter criteria.');
        return;
    }

    container.style.display = 'block';
    delBtn.style.display = 'inline-block';
    assignWrapper.style.display = 'flex';

    grid.innerHTML = filteredVideos.map(v => `
        <div style="border:1px solid #eee; border-radius:6px; overflow:hidden; background:white;">
            <img src="${v.thumbnail || getThumbnail(v.embed_code)}" style="width:100%; height:80px; object-fit:cover;">
            <div style="padding:6px; font-size:0.75rem; text-align:center; font-weight:500;">${v.title || 'Untitled'}</div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const openBtn = document.getElementById('openSmartFilterBtn');
    const panel = document.getElementById('smartFilterPanel');
    const applyBtn = document.getElementById('applyFilterBtn');
    const delBtn = document.getElementById('deleteFilteredBtn');
    const assignBtn = document.getElementById('assignFilteredBtn');
    const assignSelect = document.getElementById('assignFilteredCategorySelect');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            if (panel.style.display === 'block') loadFilterDropdowns();
        });
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', applySmartFilter);
    }

    if (delBtn) {
        delBtn.addEventListener('click', async () => {
            if (filteredVideos.length === 0) return alert('No videos to delete.');
            if (!confirm(`⚠️ Are you sure you want to delete ALL ${filteredVideos.length} filtered videos?`)) return;
            
            let deletedCount = 0;
            for (const v of filteredVideos) {
                try { await supabase.delete('videos', v.id); deletedCount++; } 
                catch (e) { console.error('Delete error:', e); }
            }
            alert(`✅ ${deletedCount} video(s) deleted successfully!`);
            filteredVideos = [];
            renderFilteredPreview();
            await loadVideos();
        });
    }

    if (assignBtn) {
        assignBtn.addEventListener('click', async () => {
            if (filteredVideos.length === 0) return alert('No videos to assign.');
            const newCat = assignSelect.value;
            if (!newCat) return alert('Please select a category.');
            if (!confirm(`Assign "${newCat}" to ALL ${filteredVideos.length} filtered videos?`)) return;

            let updatedCount = 0;
            for (const v of filteredVideos) {
                try { await supabase.patch('videos', { category: newCat }, v.id); updatedCount++; }
                catch (e) { console.error('Update error:', e); }
            }
            alert(`✅ ${updatedCount} video(s) updated to "${newCat}"!`);
            filteredVideos = [];
            renderFilteredPreview();
            await loadVideos();
        });
    }
});

// ============================================
// Auto SEO Tags Generator (New Module)
// ============================================

function autoGenerateTags(title, category) {
    let tags = [];
    
    // 1. Title سے ٹیگز نکالیں
    if (title) {
        const words = title.toLowerCase().split(' ');
        words.forEach(word => {
            // صرف 3 سے زیادہ حروف والے الفاظ کو ٹیگ بنائیں
            if (word.length > 3 && !['with', 'from', 'have', 'this', 'that', 'your', 'video'].includes(word)) {
                tags.push(word);
            }
        });
    }

    // 2. Category کو بھی ٹیگ میں شامل کریں
    if (category && category !== 'Uncategorized' && category !== 'General') {
        tags.push(category.toLowerCase());
    }

    // 3. اگر کوئی ٹیگ نہیں بنتا تو ڈیفالٹ ٹیگز
    if (tags.length === 0) {
        tags = ['trending', 'video', 'entertainment'];
    }

    // 4. ڈپلیکیٹ ہٹائیں اور زیادہ سے زیادہ 5 ٹیگز رکھیں
    const uniqueTags = [...new Set(tags)];
    return uniqueTags.slice(0, 5).join(', ');
}

// ============================================
// Auto Description Generator (New Module)
// ============================================

function autoGenerateDescription(title) {
    if (!title || title === 'Untitled Video') return 'Watch this amazing video on TrendyReels.';

    const t = title.toLowerCase();
    let desc = '';

    // مختلف کلید الفاظ کے مطابق تفصیل بنائیں
    if (t.includes('cricket') || t.includes('match') || t.includes('sports')) {
        desc = 'Watch this exciting sports action. Full of thrill and entertainment!';
    } else if (t.includes('python') || t.includes('javascript') || t.includes('code') || t.includes('tech')) {
        desc = 'Learn the latest technology and programming skills with this detailed tutorial.';
    } else if (t.includes('dua') || t.includes('quran') || t.includes('islamic') || t.includes('allah')) {
        desc = 'Listen to this beautiful Islamic content with a peaceful and heart-touching message.';
    } else if (t.includes('movie') || t.includes('film') || t.includes('song') || t.includes('music')) {
        desc = 'Enjoy the best entertainment content. Music, drama, and fun all in one place!';
    } else if (t.includes('news') || t.includes('breaking') || t.includes('update')) {
        desc = 'Stay updated with the latest news and current affairs from around the world.';
    } else {
        // ڈیفالٹ تفصیل
        desc = `Watch this interesting video: "${title}". Stay tuned for more amazing content!`;
    }

    return desc;
}

// ============================================
// Auto-Category Suggest (New Module)
// ============================================

// کیٹیگری تجویز کرنے کا فنکشن (کلید الفاظ کی مماثلت)
function autoSuggestCategory(title) {
    if (!title) return '';
    const t = title.toLowerCase();
    
    const rules = [
        { category: 'Sports', keywords: ['cricket', 'match', 'bat', 'ball', 'sports', 'football', 'bowling', 'batsman'] },
        { category: 'Technology', keywords: ['python', 'javascript', 'code', 'ai', 'tech', 'programming', 'tutorial', 'computer', 'software', 'hardware'] },
        { category: 'Islamic', keywords: ['dua', 'quran', 'namaz', 'islamic', 'allah', 'ramadan', 'hajj', 'umrah', 'masjid'] },
        { category: 'Entertainment', keywords: ['movie', 'film', 'song', 'music', 'funny', 'comedy', 'entertainment', 'drama'] },
        { category: 'News', keywords: ['news', 'breaking', 'update', 'alert', 'politics', 'world', 'pakistan'] },
        { category: 'Education', keywords: ['school', 'college', 'university', 'learn', 'course', 'lecture', 'study'] },
    ];
    
    for (const rule of rules) {
        for (const keyword of rule.keywords) {
            if (t.includes(keyword)) {
                return rule.category;
            }
        }
    }
    
    // ✅ اگر کوئی keyword میچ نہ ہو تو بے ترتیب پہلی category کے بجائے ایک مقررہ 'General'/'Uncategorized' category استعمال کریں
    const fallback = state.categories.find(c => /^(general|uncategorized|others?)$/i.test(c.name));
    return fallback ? fallback.name : 'General';
}

// ============================================
// Bulk Delete by Category with Preview (New Module)
// ============================================

function loadBulkDeleteDropdown() {
    const select = document.getElementById('bulkDeleteCategorySelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select Category...</option>';
    state.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('bulkDeleteCategorySelect');
    const previewBtn = document.getElementById('previewDeleteCategoryBtn');
    const deleteBtn = document.getElementById('bulkDeleteByCategoryBtn');
    const previewContainer = document.getElementById('bulkDeletePreviewContainer');
    const previewGrid = document.getElementById('bulkDeletePreviewGrid');

    if (select && previewBtn && deleteBtn && previewContainer && previewGrid) {
        // Preview Button
        previewBtn.addEventListener('click', () => {
            const category = select.value;
            if (!category) { alert('Please select a category first.'); return; }

            const videos = state.videos.filter(v => v.category === category);
            if (videos.length === 0) { alert(`No videos found in "${category}"`); return; }

            // دکھائیں
            previewContainer.style.display = 'block';
            deleteBtn.style.display = 'inline-block';

            // کارڈز بنائیں
            previewGrid.innerHTML = videos.map(v => `
                <div style="border:1px solid #eee; border-radius:6px; overflow:hidden; background:white;">
                    <img src="${getThumbnail(v.embed_code)}" style="width:100%; height:80px; object-fit:cover;">
                    <div style="padding:6px; font-size:0.75rem; text-align:center; font-weight:500;">${v.title || 'Untitled'}</div>
                </div>
            `).join('');
        });

        // Confirm Delete Button
        deleteBtn.addEventListener('click', async () => {
            const category = select.value;
            if (!category) { alert('Please select a category.'); return; }
            
            const videos = state.videos.filter(v => v.category === category);
            if (videos.length === 0) { alert('No videos found.'); return; }

            if (!confirm(`⚠️ Are you sure you want to permanently delete ALL ${videos.length} videos seen above in the "${category}" category?`)) return;

            let deletedCount = 0;
            for (const video of videos) {
                try {
                    await supabase.delete('videos', video.id);
                    deletedCount++;
                } catch (e) { console.error('Delete error:', e); }
            }

            alert(`✅ ${deletedCount} video(s) deleted from "${category}"!`);
            previewContainer.style.display = 'none';
            deleteBtn.style.display = 'none';
            previewGrid.innerHTML = '';
            await loadVideos();
            loadBulkDeleteDropdown();
        });
    }
});

// ============================================
// Bulk Category Assign with Preview (New Module)
// ============================================

function loadBulkCategoryDropdown() {
    const select = document.getElementById('bulkCategorySelect');
    if (!select) return;
    select.innerHTML = '<option value="">Select Category...</option>';
    state.categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.name;
        select.appendChild(opt);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('bulkCategorySelect');
    const previewBtn = document.getElementById('previewAssignBtn');
    const assignBtn = document.getElementById('bulkAssignCategoryBtn');
    const previewContainer = document.getElementById('bulkAssignPreviewContainer');
    const previewGrid = document.getElementById('bulkAssignPreviewGrid');

    if (select && previewBtn && assignBtn && previewContainer && previewGrid) {
        // Preview Button
        previewBtn.addEventListener('click', () => {
            const selected = document.querySelectorAll('.video-checkbox:checked');
            if (selected.length === 0) {
                alert('Please select at least one video from the table.');
                return;
            }
            
            const ids = Array.from(selected).map(cb => parseInt(cb.dataset.id));
            const videos = state.videos.filter(v => ids.includes(v.id));

            previewContainer.style.display = 'block';
            assignBtn.style.display = 'inline-block';

            previewGrid.innerHTML = videos.map(v => `
                <div style="border:1px solid #eee; border-radius:6px; overflow:hidden; background:white;">
                    <img src="${getThumbnail(v.embed_code)}" style="width:100%; height:80px; object-fit:cover;">
                    <div style="padding:6px; font-size:0.75rem; text-align:center; font-weight:500;">${v.title || 'Untitled'}</div>
                </div>
            `).join('');
        });

        // Confirm Assign Button
        assignBtn.addEventListener('click', async () => {
            const newCategory = select.value;
            if (!newCategory) {
                alert('Please select a category from the dropdown.');
                return;
            }

            const selected = document.querySelectorAll('.video-checkbox:checked');
            if (selected.length === 0) {
                alert('No videos selected. Please select again.');
                return;
            }
            
            const ids = Array.from(selected).map(cb => parseInt(cb.dataset.id));
            if (!confirm(`Assign ${ids.length} video(s) to category "${newCategory}"?`)) return;

            let successCount = 0;
            for (const id of ids) {
                try {
                    await supabase.patch('videos', { category: newCategory }, id);
                    successCount++;
                } catch (e) { console.error('Update error:', e); }
            }

            alert(`✅ ${successCount} video(s) updated to "${newCategory}"!`);
            previewContainer.style.display = 'none';
            assignBtn.style.display = 'none';
            previewGrid.innerHTML = '';
            await loadVideos();
            loadBulkCategoryDropdown();
        });
    }
});
// ============================================
// Duplicate Review Panel
// ============================================

function findDuplicates() {
    const videos = state.videos;
    const grouped = {};

    videos.forEach(video => {
        const id = extractVideoId(video.embed_code);
        if (!id) return;
        if (!grouped[id]) grouped[id] = [];
        grouped[id].push(video);
    });

    // صرف وہی گروپ واپس کریں جن میں 1 سے زائد ویڈیوز ہوں
    const duplicates = {};
    Object.keys(grouped).forEach(key => {
        if (grouped[key].length > 1) {
            duplicates[key] = grouped[key];
        }
    });

    return duplicates;
}

function extractVideoId(embedCode) {
    if (!embedCode) return null;

    // 1. YouTube ID
    const ytMatch = embedCode.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return ytMatch[1];

    // 2. Dailymotion ID
    const dmMatch = embedCode.match(/dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/);
    if (dmMatch) return dmMatch[1];

    // 👇 اگر YouTube یا Dailymotion نہیں ہے، تو اسے ڈپلیکیٹ میں شامل نہ کریں
    return null; 
}
function renderDuplicates() {
    const container = document.getElementById('duplicateList');
    if (!container) return;

    const duplicates = findDuplicates();
    const keys = Object.keys(duplicates);

    if (keys.length === 0) {
        container.innerHTML = `<p style="color:#888; text-align:center; padding:20px;">🎉 No duplicate videos found! Everything is clean.</p>`;
        return;
    }

    let html = '';
    keys.forEach((id, index) => {
        const group = duplicates[id];
        const original = group[0]; // پہلی ویڈیو کو اصلی سمجھیں
        const duplicatesList = group.slice(1); // باقی ڈپلیکیٹس

        html += `
        <div style="border:1px solid #ddd; border-radius:8px; padding:15px; background:#f9f9f9; margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h4 style="margin:0;">🔁 Duplicate Group #${index + 1}</h4>
                <button class="btn-danger delete-all-duplicates-btn" data-id="${id}" style="padding:6px 14px;">🗑 Delete All Duplicates (Keep 1)</button>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:10px;">
                <!-- Original -->
                <div style="padding:10px; border:2px solid #4CAF50; border-radius:6px; background:#e8f5e9;">
                    <strong>✅ Original</strong><br>
                    <img src="${getThumbnail(original.embed_code)}" style="width:100%; border-radius:4px;"><br>
                    <small>${original.title}</small>
                </div>
                <!-- Duplicates -->
                ${duplicatesList.map(v => `
                    <div style="padding:10px; border:1px solid #f44336; border-radius:6px; background:#ffebee;">
                        <strong>❌ Duplicate</strong><br>
                        <img src="${getThumbnail(v.embed_code)}" style="width:100%; border-radius:4px;"><br>
                        <small>${v.title}</small>
                    </div>
                `).join('')}
            </div>
        </div>
        `;
    });

    container.innerHTML = html;

    // ڈیلیٹ بٹن کا ایونٹ
    container.querySelectorAll('.delete-all-duplicates-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const groupId = this.dataset.id; // یہ ویڈیو ID ہے (گروپ کی کلید)
            const group = duplicates[groupId];
            if (!group || group.length < 2) return;
            
            if (confirm(`Are you sure you want to delete ${group.length - 1} duplicate(s)? The original will be kept.`)) {
                // اصلی کو چھوڑ کر باقی سب ڈیلیٹ کریں
                const toDelete = group.slice(1);
                for (const vid of toDelete) {
                    await supabase.delete('videos', vid.id);
                }
                await loadVideos(); // دوبارہ لوڈ کریں
                renderDuplicates(); // لسٹ ریفریش کریں
                alert(`✅ ${toDelete.length} duplicate(s) deleted successfully!`);
            }
        });
    });
}

// ڈپلیکیٹ ٹیب پر کلک کرنے پر رینڈر کریں
document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.admin-tab');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.dataset.tab === 'duplicates') {
                renderDuplicates();
            }
        });
    });
});

// ============================================
// Link Cleaner & Exporter Functions (New Tab)
// ============================================

function handleCleanerFile() {
    const fileInput = document.getElementById('cleanerFileInput');
    const file = fileInput.files[0];
    if (!file) return alert('Please select a file first.');

    const reader = new FileReader();
    reader.onload = function(e) {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        const parsedData = lines.map(line => {
            const parts = line.split(',').map(s => s.trim());
            let title = parts[0] || 'Untitled Video';
            let url = parts.find(p => p.startsWith('http')) || '';
            let category = parts.find(p => !p.startsWith('http') && p !== title) || 'General';
            return { title, url, category };
        }).filter(item => item.url !== '');

        if (parsedData.length === 0) {
            alert('No valid links found in the file.');
            return;
        }

        showCleanerPreview(parsedData);
    };
    reader.readAsText(file);
}

function showCleanerPreview(data) {
    const container = document.getElementById('cleanerPreviewContainer');
    const tableDiv = document.getElementById('cleanerPreviewTable');
    container.style.display = 'block';
    
    let html = `<table style="width:100%; border-collapse:collapse; font-size:0.85rem;">
        <tr style="background:#eee; font-weight:bold;"><th>#</th><th>Title</th><th>URL</th><th>Category</th></tr>`;
    data.forEach((item, i) => {
        html += `<tr><td>${i+1}</td><td>${item.title}</td><td style="font-size:0.75rem; word-break:break-all;">${item.url}</td><td>${item.category}</td></tr>`;
    });
    html += `</table>`;
    tableDiv.innerHTML = html;
    
    document.getElementById('downloadCleanedCsvBtn').style.display = 'inline-block';
    document.getElementById('downloadCleanedJsonBtn').style.display = 'inline-block';
    
    document.getElementById('downloadCleanedCsvBtn').onclick = () => downloadCleanedFile(data, 'csv');
    document.getElementById('downloadCleanedJsonBtn').onclick = () => downloadCleanedFile(data, 'json');
}

function downloadCleanedFile(data, format) {
    let content = '';
    let filename = 'cleaned_videos.';
    
    if (format === 'csv') {
        filename += 'csv';
        content = "Title,URL,Category\n";
        data.forEach(item => {
            const safeTitle = `"${item.title}"`;
            content += `${safeTitle},${item.url},${item.category}\n`;
        });
    } else if (format === 'json') {
        filename += 'json';
        content = JSON.stringify(data, null, 2);
    }
    
    const blob = new Blob([content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// ============================================
// TrendyReels - V3.5.1 (PART 6 - NEW REVIEW PANEL)
// ============================================

// 1. Review Panel لاجک (فائل اپ لوڈ ہونے کے بعد کھلے گا)
async function handleBulkUpload(file) {
    if (!file) { alert('Please select a file first.'); return; }
    const progressEl = document.getElementById('uploadProgress');
    const resultEl = document.getElementById('uploadResult');
    progressEl.style.display = 'block';
    progressEl.textContent = '📂 Reading file...';
    resultEl.style.display = 'none';

    try {
        await loadPapaParse();
        let rows = [];
        if (file.name.endsWith('.csv')) {
            const text = await file.text();
            const parsed = Papa.parse(text, { header: false, skipEmptyLines: true });
            rows = parsed.data;
        } else if (file.name.endsWith('.json')) {
            const text = await file.text();
            const json = JSON.parse(text);
            rows = Array.isArray(json) ? json : [json];
        } else {
            alert('Only .csv and .json files are supported.');
            progressEl.style.display = 'none';
            return;
        }
        if (rows.length === 0) { alert('File is empty.'); progressEl.style.display = 'none'; return; }

        // ہر ویڈیو کو پروسیس کریں اور ایک عارضی لسٹ بنائیں
        const processedVideos = [];
        for (let i = 0; i < rows.length; i++) {
            const result = await processVideoData(rows[i], true); // dryRun = true
            if (result) processedVideos.push(result);
        }

        if (processedVideos.length === 0) {
            alert('No valid videos found in the file.');
            progressEl.style.display = 'none';
            return;
        }

        // Review Panel دکھائیں
        showReviewPanel(processedVideos);
        progressEl.style.display = 'none';
    } catch (error) {
        progressEl.style.display = 'none';
        alert(`❌ Error: ${error.message}`);
    }
}

// 2. Review Panel دکھانے کا فنکشن
function showReviewPanel(videos, defaultCategory = null) {
    const modal = document.getElementById('reviewPanelModal');
    const list = document.getElementById('reviewPanelList');
    const title = document.getElementById('reviewPanelTitle');
    title.textContent = `Review Videos (${videos.length})`;
    
    list.innerHTML = videos.map((v, index) => {
        const thumbnail = v.thumbnail || 'https://images.pexels.com/photos/3200072/pexels-photo-3200072.jpeg';
        // ✅ Bot سے موصول ہونے والی category کو ترجیح دیں، ورنہ auto-suggest، ورنہ پہلی category
        const preselected = defaultCategory || autoSuggestCategory(v.title) || (state.categories[0] ? state.categories[0].name : '');
        return `
            <div class="review-item" data-index="${index}" style="display:flex; align-items:center; gap:15px; padding:10px; border:1px solid #ddd; border-radius:8px; background:#f9f9f9;">
                <img src="${thumbnail}" style="width:120px; height:68px; object-fit:cover; border-radius:4px;" onerror="this.src='https://images.pexels.com/photos/3200072/pexels-photo-3200072.jpeg'">
                <div style="flex:1;">
                    <div style="font-weight:500; font-size:0.95rem; margin-bottom:4px;">${v.title}</div>
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <label style="font-size:0.85rem;">Category:</label>
                        <select class="review-category" data-index="${index}" style="padding:4px 8px; border-radius:4px; border:1px solid #ccc; font-size:0.85rem;">
                            ${state.categories.map(c => `<option value="${c.name}" ${c.name === preselected ? 'selected' : ''}>${c.name}</option>`).join('')}
                        </select>
                        <label style="font-size:0.85rem; margin-left:10px;">
                            <input type="checkbox" class="review-approve" data-index="${index}" checked> Approve
                        </label>
                        <button class="review-remove" data-index="${index}" style="padding:4px 12px; background:#f44336; color:white; border:none; border-radius:4px; cursor:pointer;">🗑 Remove</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Remove بٹن کا ایونٹ
    list.querySelectorAll('.review-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            const item = this.closest('.review-item');
            item.remove();
            if (list.children.length === 0) {
                document.getElementById('reviewPanelSave').style.display = 'none';
            }
        });
    });

    // Save بٹن
    document.getElementById('reviewPanelSave').onclick = async () => {
        const toSave = [];
        document.querySelectorAll('.review-item').forEach(item => {
            const idx = parseInt(item.dataset.index);
            const isApproved = item.querySelector('.review-approve').checked;
            const category = item.querySelector('.review-category').value;
            if (isApproved) {
                const v = videos[idx];
                // ✅ bot کا بھیجا ہوا خارجی 'id' (مثلاً YouTube video id) ہمارے DB کے اپنے primary key کالم سے ٹکرا سکتا ہے، اس لیے اسے ہٹا دیں
                const { id, ...rest } = v;
                toSave.push({ ...rest, category: category, description: autoGenerateDescription(v.title), tags: autoGenerateTags(v.title, category) });
            }
        });

        if (toSave.length === 0) {
            alert('No videos selected to save.');
            return;
        }

        // Supabase میں محفوظ کریں
        let successCount = 0, failCount = 0, failList = [];
        for (const v of toSave) {
            try {
                // ✅ صرف اس صورت میں url پر conflict چیک کریں جب url موجود ہو (bulk-upload path)، ورنہ عام insert ہو (bot path)
                const { error } = await supabase
                    .from('videos')
                    .upsert(v, v.url ? { onConflict: 'url' } : {});
                if (error) throw error;
                successCount++;
            } catch (e) {
                failCount++;
                failList.push(`${v.title} (${e.message})`);
            }
        }

        alert(`✅ ${successCount} videos saved successfully!${failCount > 0 ? `\n⚠️ ${failCount} failed.` : ''}`);
        if (failList.length > 0) console.warn('Failed:', failList);
        await loadVideos();
        modal.classList.remove('active');
    };

    // Cancel بٹن
    document.getElementById('reviewPanelCancel').onclick = () => {
        if (confirm('Are you sure you want to cancel? No videos will be saved.')) {
            modal.classList.remove('active');
        }
    };

    // Close بٹن
    document.getElementById('closeReviewPanel').onclick = () => {
        if (confirm('Are you sure you want to close? No videos will be saved.')) {
            modal.classList.remove('active');
        }
    };

    // Modal دکھائیں
    modal.classList.add('active');
}

// 3. Upgraded processVideoData (YouTube Title Fetch کے ساتھ)
async function processVideoData(videoData, dryRun = false) {
    let url = null, title = null, category = null;
    for (const [key, value] of Object.entries(videoData)) {
        const keyLower = key.toLowerCase();
        if (value && typeof value === 'string' && value.trim().replace(/\s/g, '').startsWith('http')) {
            url = value.trim();
        }
        if (!title && (keyLower.includes('title') || keyLower.includes('name') || keyLower.includes('caption'))) {
            title = value.trim();
        }
        if (!category && (keyLower.includes('category') || keyLower.includes('cat'))) {
            category = value.trim();
        }
    }
    if (!url) {
        for (const value of Object.values(videoData)) {
            if (typeof value === 'string' && (value.trim().replace(/\s/g, '').startsWith('<iframe') || value.trim().replace(/\s/g, '').startsWith('<video'))) {
                url = value.trim();
                break;
            }
        }
    }
    if (!url) return null;
    let embedCode = '', finalUrl = '';
    if (url.trim().startsWith('<iframe') || url.trim().startsWith('<video') || url.trim().startsWith('<blockquote')) {
        embedCode = url.trim();
    } else {
        finalUrl = url;
        embedCode = autoConvertUrlToEmbed(url);
    }

    // ✅ NEW: اگر URL YouTube کا ہے اور title نہیں ہے، تو خود بخود ٹائٹل فیچ کریں
    if (!title && url.includes('youtube.com/watch?v=')) {
        try {
            const videoId = url.split('v=')[1]?.split('&')[0];
            const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=AIzaSyA-jjRqRwtyqk5lR0yIrqH7yI0jlW0t3g4`);
            const data = await response.json();
            if (data.items && data.items[0]) {
                title = data.items[0].snippet.title;
            }
        } catch (e) {
            console.warn('Could not fetch YouTube title:', e);
        }
    }
    
    if (!title) title = 'Untitled Video';
    const assignedCategory = await ensureCategory(category ? category.trim() : 'General');
    let thumbnail = '';
    if (embedCode.includes('youtube.com/embed/')) {
        const id = embedCode.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (id) thumbnail = `https://img.youtube.com/vi/${id[1]}/hqdefault.jpg`;
    }
    const freeKeywords = ['copyright free', 'no copyright', 'creative commons', 'cc0', 'royalty free'];
    let isCopyrightFree = false;
    if (title) {
        const t = title.toLowerCase();
        for (const kw of freeKeywords) {
            if (t.includes(kw)) { isCopyrightFree = true; break; }
        }
    }

    if (dryRun) {
        return {
            title: title,
            embed_code: embedCode,
            url: finalUrl,
            category: assignedCategory,
            is_copyright_free: isCopyrightFree,
            published: true,
            thumbnail: thumbnail
        };
    }

    try {
        const { data, error } = await supabase
            .from('videos')
            .upsert({ 
                title: title,
                embed_code: embedCode,
                url: finalUrl,
                category: assignedCategory,
                source: 'manual',
                is_copyright_free: isCopyrightFree,
                published: true,
                thumbnail: thumbnail
            }, { onConflict: 'url' });
        if (error) throw error;
        return { success: true, title };
    } catch (error) {
        console.error('Supabase Error:', error);
        return { success: false, title, error: error.message };
    }
        }

// ============================================
// TrendyReels - V3.6.1 (Category Manager) - PART 6
// ============================================

// 🆕 NEW: Category Manager Functions
function renderCategoryList() {
    const list = document.getElementById('categoryList');
    if (!list) return;
    
    list.innerHTML = state.categories.map(cat => {
        const count = state.videos.filter(v => v.category === cat.name).length;
        // Simple emoji icon based on category name
        const icon = getCategoryIcon(cat.name);
        return `
            <div class="category-item" data-id="${cat.id}" style="display:flex; align-items:center; justify-content:space-between; padding:10px; border:1px solid #ddd; border-radius:5px; background:#f9f9f9; margin-bottom:4px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:1.2rem;">${icon}</span>
                    <span style="font-weight:500;">${cat.name}</span>
                    <span style="font-size:0.85rem; color:#888;">(${count} videos)</span>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="edit-category-btn" data-id="${cat.id}" style="padding:4px 10px; border:none; border-radius:4px; background:#2196F3; color:white; cursor:pointer;">Edit</button>
                    <button class="delete-category-btn" data-id="${cat.id}" style="padding:4px 10px; border:none; border-radius:4px; background:#f44336; color:white; cursor:pointer;">Delete</button>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners for Edit and Delete
    list.querySelectorAll('.edit-category-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = parseInt(this.dataset.id);
            const cat = state.categories.find(c => c.id === id);
            if (!cat) return;
            const newName = prompt('Enter new category name:', cat.name);
            if (newName && newName.trim() !== '') {
                await updateCategory(id, newName.trim());
            }
        });
    });

    list.querySelectorAll('.delete-category-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const id = parseInt(this.dataset.id);
            const cat = state.categories.find(c => c.id === id);
            if (!cat) return;
            if (confirm(`Are you sure you want to delete "${cat.name}"?`)) {
                await deleteCategory(id);
            }
        });
    });
}

function getCategoryIcon(name) {
    const icons = {
        'Cricket': '🏏', 'News': '📰', 'Islamic': '🕌', 'Technology': '💻',
        'Comedy': '😂', 'Sports': '⚽', 'Education': '📚', 'Fitness-Fashion': '💪',
        'Music': '🎵', 'General': '📁'
    };
    return icons[name] || '📁';
}

async function addCategory(name) {
    if (!name || name.trim() === '') return;
    try {
        const newCat = await supabase.post('categories', { name: name.trim() });
        await loadCategories();
        renderCategoryList();
        document.getElementById('newCategoryInput').value = '';
    } catch (error) {
        alert('Error adding category: ' + error.message);
    }
}

async function updateCategory(id, newName) {
    try {
        await supabase.patch('categories', { name: newName }, id);
        await loadCategories();
        renderCategoryList();
    } catch (error) {
        alert('Error updating category: ' + error.message);
    }
}

async function deleteCategory(id) {
    try {
        await supabase.delete('categories', id);
        await loadCategories();
        renderCategoryList();
    } catch (error) {
        alert('Error deleting category: ' + error.message);
    }
}

// 🆕 Update loadCategories to call renderCategoryList
const originalLoadCategories = loadCategories;
loadCategories = async function() {
    await originalLoadCategories();
    renderCategoryList();
};

// 🆕 Attach event listener for Add Category button
document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addCategoryBtn');
    const input = document.getElementById('newCategoryInput');
    if (addBtn && input) {
        addBtn.addEventListener('click', () => addCategory(input.value));
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addCategory(input.value);
        });
    }
});
