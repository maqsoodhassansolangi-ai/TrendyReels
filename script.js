// ============================================
// TrendyReels - V3.4.1 (FINAL STABLE VERSION) - PART 1
// ============================================

const SUPABASE_URL = 'https://tdbuvlyzgxdkmheocikf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xBiU1V-ZZxLkNF-Yw6dV5A_JEdF4Uig';

// ✅ Unified and Fixed Supabase Wrapper
const supabase = {
    // Base request handler
    async query(url, options = {}) {
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
            ...options.headers
        };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        return response.json();
    },

    // New 'from' function with full chain support
    from(table) {
        return {
            queryUrl: `${SUPABASE_URL}/rest/v1/${table}`,
            
            select: function(cols = '*') {
                this.queryUrl += `?select=${cols}`;
                return this;
            },
            
            ilike: function(col, val) {
                this.queryUrl += `&${col}=ilike.*${encodeURIComponent(val)}*`;
                return this;
            },

            maybeSingle: async function() {
                const res = await fetch(this.queryUrl, {
                    headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
                });
                const data = await res.json();
                return { data: (data && data.length > 0) ? data[0] : null, error: null };
            },

            insert: async function(data) {
                return await supabase.query(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', body: JSON.stringify(data) });
            },

            upsert: async function(data, opts) {
                return await supabase.query(`${SUPABASE_URL}/rest/v1/${table}`, { 
                    method: 'POST', 
                    headers: { 'Prefer': 'resolution=merge-duplicates' }, 
                    body: JSON.stringify(data) 
                });
            }
        };
    },

    // Legacy functions for compatibility
    async get(endpoint, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.query(`${SUPABASE_URL}/rest/v1/${endpoint}?${query}`);
    },
    async post(endpoint, data) {
        return this.query(`${SUPABASE_URL}/rest/v1/${endpoint}`, { method: 'POST', body: JSON.stringify(data) });
    },
    async patch(endpoint, data, id) {
        return this.query(`${SUPABASE_URL}/rest/v1/${endpoint}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async delete(endpoint, id) {
        return this.query(`${SUPABASE_URL}/rest/v1/${endpoint}?id=eq.${id}`, { method: 'DELETE' });
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
            if (video) openVideoModal(video);
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

function openVideoModal(video) {
    state.currentVideo = video;
    const modal = $('#videoModal');
    const player = $('#videoPlayer');
    const title = $('#modalVideoTitle');
    const downloadBtn = $('#downloadBtn');
    const shareBtn = $('#shareBtn');
    if (video.embed_code.trim().startsWith('<video')) {
        player.innerHTML = video.embed_code;
        const nativeVideo = player.querySelector('video');
        if (nativeVideo) { nativeVideo.style.width = '100%'; nativeVideo.style.aspectRatio = '16/9'; nativeVideo.style.borderRadius = '8px'; nativeVideo.style.outline = 'none'; }
    } else {
        const embedUrl = extractEmbedUrl(video.embed_code);
        player.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
    }
    title.textContent = video.title || 'Untitled Video';
    if (video.is_copyright_free) {
        downloadBtn.style.display = 'inline-block';
        downloadBtn.onclick = () => {
            if (video.embed_code.trim().startsWith('<video')) {
                const srcMatch = video.embed_code.match(/src="([^"]+)"/);
                if (srcMatch) window.open(srcMatch[1], '_blank');
            } else {
                const embedUrl = extractEmbedUrl(video.embed_code);
                const ytMatch = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
                if (ytMatch) window.open(`https://www.youtube.com/watch?v=${ytMatch[1]}`, '_blank');
                else window.open(embedUrl, '_blank');
            }
        };
    } else { downloadBtn.style.display = 'none'; }
    shareBtn.onclick = () => {
        const text = `Check out "${video.title}" on TrendyReels!`;
        const url = window.location.href;
        window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    };
    modal.classList.add('active');
}

function closeVideoModal() {
    $('#videoModal').classList.remove('active');
    $('#videoPlayer').innerHTML = '';
}

function renderAdminVideos() {
    const tbody = $('#adminVideoTableBody');
    if (!tbody) return;
    if (state.videos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;">No videos added yet</td></tr>`;
        return;
    }
    tbody.innerHTML = state.videos.map(video => `
        <tr>
            <td><input type="checkbox" class="video-checkbox" data-id="${video.id}"></td>
            <td>${video.title || 'Untitled'}</td>
            <td>${video.category || 'Uncategorized'}</td>
            <td>${video.embed_code ? '✅' : '❌'}</td>
            <td>${video.is_copyright_free ? '✅ Free' : '❌ Restricted'}</td>
            <td>${video.published ? '✅ Published' : '⏳ Draft'}</td>
            <td class="actions-cell"><button class="delete-btn" onclick="deleteVideo(${video.id})">🗑</button></td>
        </tr>
    `).join('');
    const countEl = $('#totalVideosCount');
    if (countEl) countEl.textContent = state.videos.length;
}

async function deleteVideo(id) {
    if (!confirm('Delete this video?')) return;
    try { await supabase.delete('videos', id); await loadVideos(); } 
    catch (error) { alert('Failed to delete video'); }
}

async function addVideo(formData) {
    try {
        const embedCode = formData.get('embed');
        const category = formData.get('category');
        const isCopyrightFree = formData.get('copyrightFree') === 'on';
        let title = 'Video';
        const ytMatch = embedCode.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (ytMatch) {
            try {
                const resp = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${ytMatch[1]}&part=snippet&key=AIzaSyA-jjRqRwtyqk5lR0yIrqH7yI0jlW0t3g4`);
                const data = await resp.json();
                if (data.items?.[0]) title = data.items[0].snippet.title;
            } catch (e) {}
        }
        await supabase.post('videos', { title, embed_code: embedCode, category, is_copyright_free: isCopyrightFree, published: true });
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
// TrendyReels - V3.4.1 (FINAL STABLE VERSION) - PART 2
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

// --- Review Panel ---
function showReviewPanel(videos, defaultCategory = 'Technology') {
    if (!videos || videos.length === 0) { alert('No videos to review.'); return; }
    state.pendingVideos = videos.map(v => ({ ...v, selectedCategory: defaultCategory, approved: true, is_copyright_free: v.is_copyright_free }));
    const modal = document.createElement('div');
    modal.id = 'reviewModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '3000';
    let html = `
        <div class="modal-content" style="max-width:800px; width:95%; max-height:80vh; overflow-y:auto; padding:20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2>Review Videos (${videos.length})</h2>
                <button id="closeReviewModal" style="background:none; border:none; font-size:24px; cursor:pointer;">&times;</button>
            </div>
            <div style="display:flex; gap:10px; margin-bottom:20px; flex-wrap:wrap;">
                <button id="approveAllBtn" style="padding:8px 16px; background:#4CAF50; color:white; border:none; border-radius:5px; cursor:pointer;">✅ Approve All</button>
                <button id="rejectAllBtn" style="padding:8px 16px; background:#f44336; color:white; border:none; border-radius:5px; cursor:pointer;">❌ Reject All</button>
                <button id="saveSelectedBtn" style="padding:8px 16px; background:#2196F3; color:white; border:none; border-radius:5px; cursor:pointer;">💾 Save Selected</button>
            </div>
            <div id="reviewList" style="display:flex; flex-direction:column; gap:10px;">
    `;
    videos.forEach((v, idx) => {
        const statusText = v.is_copyright_free ? '✅ Free' : '❌ Restricted';
        html += `
            <div class="review-item" data-index="${idx}" style="display:flex; align-items:center; gap:15px; padding:10px; border:1px solid #ddd; border-radius:8px; background:#f9f9f9;">
                <img src="${v.thumbnail || getThumbnail(v.embed_code)}" style="width:120px; height:68px; object-fit:cover; border-radius:4px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2268%22><rect fill=%22%23ccc%22/></svg>'">
                <div style="flex:1;">
                    <div style="font-weight:500; font-size:0.95rem; margin-bottom:4px;">${v.title}</div>
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <label style="font-size:0.85rem;">Category:</label>
                        <select class="review-category" data-index="${idx}" style="padding:4px 8px; border-radius:4px; border:1px solid #ccc; font-size:0.85rem;">
                            ${state.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                        </select>
                        <label style="font-size:0.85rem; margin-left:10px;"><input type="checkbox" class="review-approve" data-index="${idx}" checked> Approve</label>
                        <label style="font-size:0.85rem; margin-left:10px; color:${v.is_copyright_free ? '#4CAF50' : '#f44336'};">
                            <input type="checkbox" class="review-copyright" data-index="${idx}" ${v.is_copyright_free ? 'checked' : ''}> 
                            Copyright Free? <span style="font-size:0.7rem;">(${statusText})</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    });
    html += `
            </div>
            <div style="margin-top:20px; text-align:right;"><button id="closeReviewModalBottom" style="padding:10px 20px; background:#666; color:white; border:none; border-radius:5px; cursor:pointer;">Close</button></div>
        </div>
    `;
    modal.innerHTML = html;
    document.body.appendChild(modal);
    const closeModal = () => { if (modal.parentNode) modal.parentNode.removeChild(modal); };
    document.getElementById('closeReviewModal').addEventListener('click', closeModal);
    document.getElementById('closeReviewModalBottom').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.getElementById('approveAllBtn').addEventListener('click', () => {
        document.querySelectorAll('.review-approve').forEach(cb => cb.checked = true);
    });
    document.getElementById('rejectAllBtn').addEventListener('click', () => {
        document.querySelectorAll('.review-approve').forEach(cb => cb.checked = false);
    });
    const saveBtn = document.getElementById('saveSelectedBtn');
    const checkApproved = () => {
        saveBtn.style.display = document.querySelectorAll('.review-approve:checked').length > 0 ? 'inline-block' : 'none';
    };
    document.querySelectorAll('.review-approve').forEach(cb => cb.addEventListener('change', checkApproved));
    checkApproved();
    saveBtn.addEventListener('click', async () => {
        const toSave = [];
        document.querySelectorAll('.review-item').forEach(item => {
            const idx = parseInt(item.dataset.index);
            if (item.querySelector('.review-approve').checked) {
                const v = state.pendingVideos[idx];
                toSave.push({ ...v, category: item.querySelector('.review-category').value, is_copyright_free: item.querySelector('.review-copyright').checked });
            }
        });
        if (toSave.length === 0) { alert('No videos selected.'); return; }
        saveBtn.textContent = '⏳ Saving...';
        saveBtn.disabled = true;
        try {
            for (const v of toSave) {
                await supabase.post('videos', {
                    title: v.title,
                    embed_code: v.embed_code,
                    category: v.category || 'Technology',
                    is_copyright_free: v.is_copyright_free,
                    published: true
                });
            }
            alert(`✅ ${toSave.length} videos saved!`);
            await loadVideos();
            closeModal();
        } catch (error) { alert(`❌ Error: ${error.message}`); }
        finally { saveBtn.textContent = '💾 Save Selected'; saveBtn.disabled = false; }
    });
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
            embed_code: `<video controls src="${v.videos.large.url || v.videos.tiny.url}" poster="${v.videos.large.thumbnail || v.videos.tiny.thumbnail || v.webformatURL || v.previewURL || v.image}"></video>`,
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
const ADMIN_PASSWORD = 'admin123';
let tapCount = 0;
let tapTimer = null;

function initSecretAdmin() {
    const secretBtn = $('#secretAdminBtn');
    if (!secretBtn) return;
    secretBtn.addEventListener('click', () => {
        tapCount++;
        clearTimeout(tapTimer);
        tapTimer = setTimeout(() => { tapCount = 0; }, 1000);
        if (tapCount === 5) {
            const password = prompt('🔐 Enter Admin Password:');
            if (password === ADMIN_PASSWORD) window.location.href = 'admin.html';
            else { alert('❌ Wrong password!'); tapCount = 0; }
        }
    });
                   }

// ============================================
// TrendyReels - V3.4.1 (FINAL STABLE VERSION) - PART 3
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
        // Check if category exists
        const existing = await supabase.get('categories', { name: categoryName });
        if (existing && existing.length > 0) return existing[0].name;
        
        // If not, create it
        const newCat = await supabase.post('categories', { name: categoryName });
        return newCat[0]?.name || 'General';
    } catch (error) {
        console.error('Error ensuring category:', error);
        return 'General';
    }
}

async function processVideoData(videoData) {
    let url = null, title = null, category = null;
    const possibleUrlKeys = ['url','URL','link','Link','embed','Embed','embed_code','EmbedCode','video_url','VideoUrl'];
    const possibleTitleKeys = ['title','Title','name','Name','caption','Caption','video_title','VideoTitle'];
    const possibleCategoryKeys = ['category','Category','cat','Cat'];
    for (const key of possibleUrlKeys) if (videoData[key]) { url = videoData[key]; break; }
    for (const key of possibleTitleKeys) if (videoData[key]) { title = videoData[key]; break; }
    for (const key of possibleCategoryKeys) if (videoData[key]) { category = videoData[key]; break; }
    if (!category && title) {
        const keywords = {
            'cricket':'Cricket','news':'News','islamic':'Islamic','technology':'Technology','tech':'Technology',
            'comedy':'Comedy','funny':'Comedy','sports':'Sports','education':'Education','fitness':'Fitness-Fashion','fashion':'Fitness-Fashion'
        };
        for (const [key, value] of Object.entries(keywords)) {
            if (title.toLowerCase().includes(key)) { category = value; break; }
        }
    }
    const assignedCategory = await ensureCategory(category || 'General');
    let embedCode = '', finalUrl = '';
    if (url && (url.trim().startsWith('<iframe') || url.trim().startsWith('<video') || url.trim().startsWith('<blockquote'))) {
        embedCode = url.trim();
    } else if (url) {
        finalUrl = url;
        embedCode = autoConvertUrlToEmbed(url);
    } else {
        return null;
    }
    let thumbnail = '';
    if (embedCode.includes('youtube.com/embed/')) {
        const id = embedCode.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (id) thumbnail = `https://img.youtube.com/vi/${id[1]}/hqdefault.jpg`;
    }
    const freeKeywords = ['copyright free','no copyright','creative commons','cc0','royalty free'];
    let isCopyrightFree = true;
    if (title) {
        const t = title.toLowerCase();
        for (const kw of freeKeywords) if (t.includes(kw)) isCopyrightFree = true;
    }
    try {
        const { data, error } = await supabase
            .from('videos')
            .upsert({ 
                title: title || 'Untitled Video',
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
        return { success: false, title, error: error.message };
    }
}

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
    return `<video controls src="${url}" style="width:100%;"></video>`;
      }

// ============================================
// TrendyReels - V3.4.1 (FINAL STABLE VERSION) - PART 4
// ============================================

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
            const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
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
        progressEl.textContent = `⏳ Processing ${rows.length} videos...`;
        let successCount = 0, failCount = 0, failList = [];
        for (let i = 0; i < rows.length; i++) {
            progressEl.textContent = `⏳ Processing ${i+1} / ${rows.length}...`;
            const result = await processVideoData(rows[i]);
            if (result && result.success) successCount++;
            else if (result) { failCount++; failList.push(`${result.title} (${result.error})`); }
        }
        progressEl.style.display = 'none';
        resultEl.style.display = 'block';
        resultEl.innerHTML = `✅ Upload Complete!<br>📹 ${successCount} videos added.<br>${failCount > 0 ? `⚠️ ${failCount} failed.` : ''}`;
        if (failList.length > 0) console.warn('Failed:', failList);
        await loadVideos();
    } catch (error) {
        progressEl.style.display = 'none';
        alert(`❌ Error: ${error.message}`);
    }
}

let searchTimeout = null;
function handleSearch(query) {
    state.searchQuery = query;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderVideos(), 300);
}

async function init() {
    applyTheme();
    await loadCategories();
    await loadVideos();
    await loadAdSlots();
    initSecretAdmin();
    const searchInput = $('#searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
        $('#searchBtn').addEventListener('click', () => handleSearch(searchInput.value));
    }
    const themeToggle = $('#themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
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
    console.log('TrendyReels V3.4.1 (FINAL STABLE VERSION) initialized!');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.deleteVideo = deleteVideo;
