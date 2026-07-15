// ============================================
// TrendyReels - Main JavaScript (V2.1 - PART 1)
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://tdbuvlyzgxdkmheocikf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xBiU1V-ZZxLkNF-Yw6dV5A_JEdF4Uig';

const supabase = {
    async query(endpoint, options = {}) {
        const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
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
    const selected = document.querySelectorAll('.video-checkbox:checked');
    if (selected.length === 0) {
        alert('No videos selected.');
        return;
    }
    const ids = Array.from(selected).map(cb => parseInt(cb.dataset.id));
    if (!confirm(`Delete ${ids.length} selected video(s)?`)) return;
    try {
        for (const id of ids) {
            await supabase.delete('videos', id);
        }
        await loadVideos();
        alert(`✅ ${ids.length} video(s) deleted.`);
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    }
}

// --- Auto-Detect Copyright ---
function autoDetectCopyright(title, channel) {
    const restrictedKeywords = [
        'copyright', 'all rights reserved', 'sony', 'warner', 'universal',
        'disney', 'netflix', 'amazon prime', 'hbo', 'paramount',
        '©', '®', 'trademark', 'licensed', 'exclusive'
    ];
    const text = (title + ' ' + channel).toLowerCase();
    for (const keyword of restrictedKeywords) {
        if (text.includes(keyword)) {
            return false;
        }
    }
    return true;
        }
// ============================================
// TrendyReels - Main JavaScript (V2.1 - PART 2)
// ============================================
// --- MODULE 9: FETCH VIDEOS (FINAL FIXED VERSION) ---
async function fetchVideosForReview(botName, keyword, maxResults, licenseFilter = '') {
    let apiUrl = '';
    let isPexels = false;
    const YOUTUBE_API_KEY = 'AIzaSyA-jjRqRwtyqk5lR0yIrqH7yI0jlW0t3g4';
    
    if (botName === 'youtube') {
        apiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&maxResults=${maxResults}&type=video${licenseFilter}&key=${YOUTUBE_API_KEY}`;
    } else if (botName === 'pexels') {
        isPexels = true;
        apiUrl = `https://pixabay.com/api/videos/?key=56707588-7f7c040c1e2ca5ef1b417bc38&q=${encodeURIComponent(keyword)}&per_page=${maxResults}`;
    } else {
        alert('Unknown bot');
        return [];
    }

    if (botName === 'youtube') {
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('YouTube API error');
            const json = await response.json();
            return json.items.map(item => ({
                id: item.id.videoId,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails.high.url,
                embed_code: `<iframe width="560" height="315" src="https://www.youtube.com/embed/${item.id.videoId}" frameborder="0" allowfullscreen></iframe>`,
                channel: item.snippet.channelTitle,
                is_copyright_free: autoDetectCopyright(item.snippet.title, item.snippet.channelTitle)
            }));
        } catch (error) {
            alert(`❌ YouTube API Error: ${error.message}`);
            return [];
        }
    }

    if (botName === 'pexels') {
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('Pixabay API error');
            const json = await response.json();
            
            if (!json.hits || json.hits.length === 0) {
                alert(`No videos found on Pixabay for "${keyword}"`);
                return [];
            }

            return json.hits.map(video => ({
                id: video.id,
                title: video.tags || 'Pixabay Video',
                // ✅ FINAL FIX: Pixabay کا صحیح تھمب نیل لنک
                thumbnail: video.previewURL || video.image || video.webformatURL,
                // ✅ FINAL FIX: ویڈیو کے صحیح لنک (بڑا نہ ہو تو چھوٹا استعمال کریں)
                embed_code: `<video controls src="${video.videos.large.url || video.videos.tiny.url}" poster="${video.previewURL}"></video>`,
                channel: video.user || 'Pixabay',
                is_copyright_free: true
            }));
        } catch (error) {
            alert(`❌ Pixabay API Error: ${error.message}`);
            return [];
        }
    }
}


async function handleBotClick(botName) {
    const keyword = prompt(`Enter search keyword for ${botName}:`, botName === 'youtube' ? 'cricket' : 'nature');
    if (!keyword) return;

    const count = prompt('How many videos? (1-50):', '10');
    if (!count || isNaN(count) || parseInt(count) < 1) return;

    const filterChoice = prompt(
        `Select Copyright Filter:\n1 = Only Copyright Free\n2 = Only Copyrighted\n3 = Mixed\n\nEnter 1, 2, or 3:`, 
        '3'
    );
    
    let licenseFilter = '';
    if (filterChoice === '1') {
        licenseFilter = '&videoLicense=creativeCommon';
        alert('🔍 Fetching ONLY Copyright Free videos...');
    } else if (filterChoice === '2') {
        licenseFilter = '&videoLicense=any';
        alert('🔍 Fetching ONLY Copyrighted videos...');
    } else {
        licenseFilter = '';
        alert('🔍 Fetching Mixed videos...');
    }

    const videos = await fetchVideosForReview(botName, keyword, parseInt(count), licenseFilter);
    if (videos.length > 0) {
        showReviewPanel(videos);
    }
}

function showReviewPanel(videos) {
    if (!videos || videos.length === 0) {
        alert('No videos to review.');
        return;
    }

    state.pendingVideos = videos.map(v => ({ 
        ...v, 
        selectedCategory: 'Technology', 
        approved: true,
        is_copyright_free: v.is_copyright_free
    }));

    const modal = document.createElement('div');
    modal.id = 'reviewModal';
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.style.zIndex = '3000';

    let html = `
        <div class="modal-content" style="max-width: 800px; width: 95%; max-height: 80vh; overflow-y: auto; padding: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <h2 style="margin: 0;">Review Videos (${videos.length})</h2>
                <button id="closeReviewModal" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                <button id="approveAllBtn" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">✅ Approve All</button>
                <button id="rejectAllBtn" style="padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">❌ Reject All</button>
                <button id="saveSelectedBtn" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">💾 Save Selected</button>
            </div>
            <div id="reviewList" style="display: flex; flex-direction: column; gap: 10px;">
    `;

    videos.forEach((v, index) => {
        const statusText = v.is_copyright_free ? '✅ Free (Auto-Detected)' : '❌ Restricted (Auto-Detected)';
        const statusColor = v.is_copyright_free ? '#4CAF50' : '#f44336';
        html += `
            <div class="review-item" data-index="${index}" style="display: flex; align-items: center; gap: 15px; padding: 10px; border: 1px solid #ddd; border-radius: 8px; background: #f9f9f9;">
                <img src="${v.thumbnail || getThumbnail(v.embed_code)}" style="width: 120px; height: 68px; object-fit: cover; border-radius: 4px;" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%2268%22><rect fill=%22%23ccc%22/></svg>'">
                <div style="flex: 1;">
                    <div style="font-weight: 500; font-size: 0.95rem; margin-bottom: 4px;">${v.title || 'Untitled'}</div>
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        <label style="font-size: 0.85rem;">Category:</label>
                        <select class="review-category" data-index="${index}" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc; font-size: 0.85rem;">
                            ${state.categories.map(cat => `<option value="${cat.name}" ${v.category === cat.name ? 'selected' : ''}>${cat.name}</option>`).join('')}
                        </select>
                        <label style="font-size: 0.85rem; margin-left: 10px;">
                            <input type="checkbox" class="review-approve" data-index="${index}" checked> Approve
                        </label>
                        <label style="font-size: 0.85rem; margin-left: 10px; color: ${statusColor};">
                            <input type="checkbox" class="review-copyright" data-index="${index}" ${v.is_copyright_free ? 'checked' : ''}> 
                            Copyright Free? <span style="font-size: 0.7rem;">(${statusText})</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <div style="margin-top: 20px; text-align: right;">
                <button id="closeReviewModalBottom" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
            </div>
        </div>
    `;

    modal.innerHTML = html;
    document.body.appendChild(modal);

    const closeModal = () => {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
    };
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
        const anyApproved = document.querySelectorAll('.review-approve:checked').length > 0;
        saveBtn.style.display = anyApproved ? 'inline-block' : 'none';
    };
    document.querySelectorAll('.review-approve').forEach(cb => cb.addEventListener('change', checkApproved));
    checkApproved();

    saveBtn.addEventListener('click', async () => {
        const toSave = [];
        document.querySelectorAll('.review-item').forEach(item => {
            const index = parseInt(item.dataset.index);
            const isApproved = item.querySelector('.review-approve').checked;
            const category = item.querySelector('.review-category').value;
            const isCopyrightFree = item.querySelector('.review-copyright').checked;
            if (isApproved) {
                const v = state.pendingVideos[index];
                toSave.push({ ...v, category, is_copyright_free: isCopyrightFree });
            }
        });

        if (toSave.length === 0) {
            alert('No videos selected to save.');
            return;
        }

        saveBtn.textContent = '⏳ Saving...';
        saveBtn.disabled = true;

        try {
            for (const v of toSave) {
                await supabase.post('videos', {
                    title: v.title,
                    embed_code: v.embed_code,
                    category: v.category || 'Technology',
                    is_copyright_free: v.is_copyright_free,
                    published: true,
                    created_at: new Date().toISOString()
                });
            }
            alert(`✅ ${toSave.length} videos saved successfully!`);
            await loadVideos();
            closeModal();
        } catch (error) {
            alert(`❌ Error saving videos: ${error.message}`);
        } finally {
            saveBtn.textContent = '💾 Save Selected';
            saveBtn.disabled = false;
        }
    });
}

// ============================================
// 🆕 NEW MODULE: ULTIMATE ADS MANAGER (V2.1)
// ============================================

async function loadAdSlots() {
    try {
        const data = await supabase.get('ad_slots');
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
    
    // 8 Slot Definitions with Mobile & Desktop sizes
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

    // Merge with existing slots from DB
    const slots = slotConfigs.map(config => {
        const existing = state.adSlots.find(s => s.name === config.name);
        return {
            ...config,
            enabled: existing ? existing.enabled : false,
            mobileCode: existing ? existing.mobileCode || '' : '',
            desktopCode: existing ? existing.desktopCode || '' : ''
        };
    });

    grid.innerHTML = slots.map(slot => `
        <div class="ad-slot-card" data-name="${slot.name}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <h3>${slot.label} Ad</h3>
                <label class="toggle-switch">
                    <input type="checkbox" class="ad-toggle" ${slot.enabled ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <div style="font-size:0.8rem; color:#666; margin-bottom:8px;">
                📱 Mobile: <strong>${slot.mobile}</strong> &nbsp;|&nbsp; 💻 Desktop: <strong>${slot.desktop}</strong>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <div>
                    <label style="font-size:0.75rem; font-weight:bold;">📱 Mobile Code</label>
                    <textarea class="ad-code-mobile" rows="3" placeholder="Paste mobile ad code...">${slot.mobileCode || ''}</textarea>
                </div>
                <div>
                    <label style="font-size:0.75rem; font-weight:bold;">💻 Desktop Code</label>
                    <textarea class="ad-code-desktop" rows="3" placeholder="Paste desktop ad code...">${slot.desktopCode || ''}</textarea>
                </div>
            </div>
            <button class="btn-secondary save-ad-btn" style="margin-top:8px; width:100%;">💾 Save</button>
        </div>
    `).join('');

    // Save Handlers
    grid.querySelectorAll('.save-ad-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.ad-slot-card');
            const name = card.dataset.name;
            const enabled = card.querySelector('.ad-toggle').checked;
            const mobileCode = card.querySelector('.ad-code-mobile').value;
            const desktopCode = card.querySelector('.ad-code-desktop').value;
            
            try {
                const existing = state.adSlots.find(s => s.name === name);
                if (existing) {
                    await supabase.patch('ad_slots', { enabled, mobileCode, desktopCode }, existing.id);
                } else {
                    await supabase.post('ad_slots', { name, enabled, mobileCode, desktopCode });
                }
                await loadAdSlots();
                alert(`✅ ${name} ad slot saved!`);
            } catch (error) {
                alert(`❌ Error saving: ${error.message}`);
            }
        });
    });
}

// --- Secret Admin Entry ---
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

// --- Search ---
let searchTimeout = null;
function handleSearch(query) {
    state.searchQuery = query;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderVideos(), 300);
}

// --- Init ---
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

    const runYoutubeBtn = $('#runYoutubeBot');
    if (runYoutubeBtn) {
        runYoutubeBtn.addEventListener('click', () => handleBotClick('youtube'));
    }

    const runPexelsBtn = $('#runPexelsBot');
    if (runPexelsBtn) {
        runPexelsBtn.addEventListener('click', () => handleBotClick('pexels'));
    }
    
    console.log('TrendyReels V2.1 initialized!');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.deleteVideo = deleteVideo;
