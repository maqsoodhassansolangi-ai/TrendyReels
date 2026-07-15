// ============================================
// TrendyReels - Main JavaScript (PART 1 - FULL LOGIC)
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://tdbuvlyzgxdkmheocikf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xBiU1V-ZZxLkNF-Yw6dV5A_JEdF4Uig';

// Supabase Client
const supabase = {
    async query(endpoint, options = {}) {
        const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
        const headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            ...options.headers
        };
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) throw new Error(`Supabase error: ${response.status}`);
        return response.json();
    },
    async get(endpoint, params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.query(`${endpoint}?${query}`);
    },
    async post(endpoint, data) {
        return this.query(endpoint, { method: 'POST', body: JSON.stringify(data) });
    },
    async patch(endpoint, data, id) {
        return this.query(`${endpoint}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(data) });
    },
    async delete(endpoint, id) {
        return this.query(`${endpoint}?id=eq.${id}`, { method: 'DELETE' });
    }
};

// ============================================
// State
// ============================================
let state = {
    videos: [],
    categories: [],
    adSlots: [],
    currentCategory: 'all',
    searchQuery: '',
    darkMode: localStorage.getItem('trendyreels-theme') === 'dark',
    currentVideo: null
};

// ============================================
// DOM References
// ============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ============================================
// Theme Management
// ============================================
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

// ============================================
// Categories
// ============================================
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

// ============================================
// Videos
// ============================================
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
        filtered = filtered.filter(v => 
            v.category && v.category.toLowerCase() === state.currentCategory
        );
    }
    
    if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter(v => 
            v.title && v.title.toLowerCase().includes(q)
        );
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state"><p>No videos found</p></div>`;
        return;
    }
    
    grid.innerHTML = filtered.map(video => `
        <div class="video-card" data-id="${video.id}">
            <img class="video-thumbnail" 
                 src="${getThumbnail(video.embed_code)}" 
                 alt="${video.title || 'Video'}"
                 loading="lazy"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22320%22 height=%22180%22><rect fill=%22%23CCCCCC%22 width=%22320%22 height=%22180%22/><text x=%2250%%22 y=%2250%%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22%23666%22 font-size=%2220%22>No Thumbnail</text></svg>'">
            <div class="video-info">
                <div class="video-title">${video.title || 'Untitled Video'}</div>
                <div class="video-meta">
                    <span class="video-category">${video.category || 'Uncategorized'}</span>
                    ${video.is_copyright_free ? '<span class="copyright-badge">© Free</span>' : ''}
                </div>
            </div>
        </div>
    `).join('');
    
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
    return '';
}

function extractEmbedUrl(embedCode) {
    const ytMatch = embedCode.match(/src="([^"]+youtube\.com\/embed\/[^"]+)"/);
    if (ytMatch) return ytMatch[1];
    const dmMatch = embedCode.match(/src="([^"]+dailymotion\.com\/embed\/[^"]+)"/);
    if (dmMatch) return dmMatch[1];
    return embedCode.trim();
}
// ============================================
// TrendyReels - Main JavaScript (PART 2 - FULL LOGIC)
// ============================================

// ============================================
// Video Modal
// ============================================
function openVideoModal(video) {
    state.currentVideo = video;
    const modal = $('#videoModal');
    const player = $('#videoPlayer');
    const title = $('#modalVideoTitle');
    const downloadBtn = $('#downloadBtn');
    const shareBtn = $('#shareBtn');
    
    const embedUrl = extractEmbedUrl(video.embed_code);
    player.innerHTML = `<iframe src="${embedUrl}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
    title.textContent = video.title || 'Untitled Video';
    
    if (video.is_copyright_free) {
        downloadBtn.style.display = 'inline-block';
        downloadBtn.onclick = () => {
            const ytMatch = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
            if (ytMatch) {
                window.open(`https://www.youtube.com/watch?v=${ytMatch[1]}`, '_blank');
            } else {
                window.open(embedUrl, '_blank');
            }
        };
    } else {
        downloadBtn.style.display = 'none';
    }
    
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

// ============================================
// Admin - Videos
// ============================================
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
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${video.embed_code ? '✅' : '❌'}</td>
            <td>${video.is_copyright_free ? '✅ Free' : '❌ Restricted'}</td>
            <td>${video.published ? '✅ Published' : '⏳ Draft'}</td>
            <td class="actions-cell">
                <button class="delete-btn" onclick="deleteVideo(${video.id})">🗑</button>
            </td>
        </tr>
    `).join('');
    
    const countEl = $('#totalVideosCount');
    if (countEl) countEl.textContent = state.videos.length;
}

async function deleteVideo(id) {
    if (!confirm('Delete this video?')) return;
    try {
        await supabase.delete('videos', id);
        await loadVideos();
    } catch (error) {
        console.error('Error deleting video:', error);
        alert('Failed to delete video');
    }
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
                if (data.items && data.items[0]) {
                    title = data.items[0].snippet.title;
                }
            } catch (e) {
                console.warn('Could not fetch title:', e);
            }
        }
        
        const newVideo = {
            title: title,
            embed_code: embedCode,
            category: category,
            is_copyright_free: isCopyrightFree,
            published: true,
            created_at: new Date().toISOString()
        };
        
        await supabase.post('videos', newVideo);
        await loadVideos();
        return true;
    } catch (error) {
        console.error('Error adding video:', error);
        return false;
    }
}

async function bulkPublish() {
    if (!confirm('Publish all videos?')) return;
    try {
        for (const video of state.videos) {
            await supabase.patch('videos', { published: true }, video.id);
        }
        await loadVideos();
    } catch (error) {
        console.error('Error publishing videos:', error);
        alert('Failed to publish all videos');
    }
}

async function bulkDelete() {
    if (!confirm('Delete ALL videos? This cannot be undone!')) return;
    try {
        for (const video of state.videos) {
            await supabase.delete('videos', video.id);
        }
        await loadVideos();
    } catch (error) {
        console.error('Error deleting videos:', error);
        alert('Failed to delete all videos');
    }
}

// ============================================
// Admin - Ads
// ============================================
async function loadAdSlots() {
    try {
        const data = await supabase.get('ad_slots', { select: '*' });
        state.adSlots = data || [];
        renderAdSlots();
        return data;
    } catch (error) {
        console.error('Error loading ad slots:', error);
        return [];
    }
}

function renderAdSlots() {
    const grid = $('#adSlotsGrid');
    if (!grid) return;
    
    const defaultSlots = ['header', 'sidebar', 'video_top', 'video_bottom', 'footer', 'mobile'];
    const slots = state.adSlots.length > 0 ? state.adSlots : defaultSlots.map(name => ({ name, enabled: false, code: '' }));
    
    grid.innerHTML = slots.map(slot => `
        <div class="ad-slot-card" data-name="${slot.name}">
            <h3>${slot.name.charAt(0).toUpperCase() + slot.name.slice(1)} Ad</h3>
            <label class="toggle-switch">
                <input type="checkbox" class="ad-toggle" ${slot.enabled ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
            <span>${slot.enabled ? 'ON' : 'OFF'}</span>
            <textarea class="ad-code" placeholder="Paste Adsterra code here...">${slot.code || ''}</textarea>
            <button class="btn-secondary save-ad-btn" style="margin-top:8px;">Save</button>
        </div>
    `).join('');
    
    grid.querySelectorAll('.save-ad-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.ad-slot-card');
            const name = card.dataset.name;
            const enabled = card.querySelector('.ad-toggle').checked;
            const code = card.querySelector('.ad-code').value;
            
            try {
                const existing = state.adSlots.find(s => s.name === name);
                if (existing) {
                    await supabase.patch('ad_slots', { enabled, code }, existing.id);
                } else {
                    await supabase.post('ad_slots', { name, enabled, code });
                }
                await loadAdSlots();
                alert('Ad slot saved!');
            } catch (error) {
                console.error('Error saving ad slot:', error);
                alert('Failed to save ad slot');
            }
        });
    });
}

// ============================================
// Secret Admin Entry (Mobile Friendly - Tap 5 times)
// ============================================
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
            if (password === ADMIN_PASSWORD) {
                window.location.href = 'admin.html';
            } else {
                alert('❌ Wrong password!');
                tapCount = 0;
            }
        }
    });
}

// ============================================
// 🚀 FINAL FIX: Bot Integration (Direct Worker Call)
// ============================================
async function runBot(botName, keyword = 'trending') {
    let url = '';
    if (botName === 'youtube') {
        url = `https://youtube-bot.maqsoodhassansolangi.workers.dev/?q=${encodeURIComponent(keyword)}`;
    } else if (botName === 'pexels') {
        url = `https://pexels-bot.maqsoodhassansolangi.workers.dev/?q=${encodeURIComponent(keyword)}`;
    } else {
        alert('Unknown bot');
        return;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to reach bot');
        
        const data = await response.json();
        if (!data.success) throw new Error(data.error);
        
        // Save each video to Supabase
        for (const video of data.videos) {
            await supabase.post('videos', {
                title: video.title,
                embed_code: video.embed_code,
                category: video.category || 'Technology',
                is_copyright_free: video.is_copyright_free,
                published: true,
                created_at: new Date().toISOString()
            });
        }
        alert(`✅ ${data.videos.length} videos added from ${botName}!`);
        await loadVideos();
    } catch (error) {
        alert(`❌ Error running ${botName}: ${error.message}`);
    }
}

// ============================================
// Search
// ============================================
let searchTimeout = null;
function handleSearch(query) {
    state.searchQuery = query;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderVideos(), 300);
}

// ============================================
// Initialization
// ============================================
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
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeVideoModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeVideoModal();
        });
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
        addModal.addEventListener('click', (e) => {
            if (e.target === addModal) addModal.classList.remove('active');
        });
        
        $('#addVideoForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const success = await addVideo(formData);
            if (success) {
                addModal.classList.remove('active');
                e.target.reset();
            } else {
                alert('Failed to add video. Check console for details.');
            }
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

    // Bot buttons
    const runYoutubeBtn = $('#runYoutubeBot');
    if (runYoutubeBtn) {
        runYoutubeBtn.addEventListener('click', () => {
            const keyword = prompt('Enter search keyword for YouTube:', 'cricket');
            if (keyword) runBot('youtube', keyword);
        });
    }

    const runPexelsBtn = $('#runPexelsBot');
    if (runPexelsBtn) {
        runPexelsBtn.addEventListener('click', () => {
            const keyword = prompt('Enter search keyword for Pexels:', 'nature');
            if (keyword) runBot('pexels', keyword);
        });
    }
    
    console.log('TrendyReels initialized!');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.deleteVideo = deleteVideo;
