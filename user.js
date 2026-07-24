// ============================================
// USER.JS - FINAL PHASE 3 (Auto-Complete + Native Share + History + Copy Link)
// ============================================

function getAdjacentVideo(direction) {
    const current = state.currentVideo;
    if (!current) return null;
    const currentIndex = state.videos.findIndex(v => v.id === current.id);
    if (currentIndex === -1) return null;
    const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0 || newIndex >= state.videos.length) return null;
    return state.videos[newIndex];
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + (secs < 10 ? '0' : '') + secs;
}

// ============================================
// ✅ LIKE BUTTON (Device-based — اسی browser پر یاد رہتا ہے)
// ============================================
function getLikedVideoIds() {
    try { return JSON.parse(localStorage.getItem('tr_liked_videos') || '[]'); } catch (e) { return []; }
}
function setupLikeButton(video) {
    const likeBtn = document.getElementById('likeBtn');
    const likeCount = document.getElementById('likeCount');
    if (!likeBtn) return;

    let likedIds = getLikedVideoIds();
    let isLiked = likedIds.includes(video.id);
    likeBtn.style.background = isLiked ? '#FF0000' : 'transparent';
    likeBtn.style.color = isLiked ? 'white' : 'inherit';

    likeBtn.addEventListener('click', async () => {
        likeBtn.disabled = true;
        try {
            likedIds = getLikedVideoIds();
            isLiked = likedIds.includes(video.id);
            if (isLiked) {
                const { data } = await supabase.rpc('decrement_video_likes', { vid: video.id });
                likedIds = likedIds.filter(id => id !== video.id);
                likeCount.textContent = data ?? Math.max(0, (parseInt(likeCount.textContent) || 0) - 1);
                likeBtn.style.background = 'transparent';
                likeBtn.style.color = 'inherit';
            } else {
                const { data } = await supabase.rpc('increment_video_likes', { vid: video.id });
                likedIds.push(video.id);
                likeCount.textContent = data ?? (parseInt(likeCount.textContent) || 0) + 1;
                likeBtn.style.background = '#FF0000';
                likeBtn.style.color = 'white';
            }
            localStorage.setItem('tr_liked_videos', JSON.stringify(likedIds));
        } catch (e) {
            alert('Like میں مسئلہ، دوبارہ کوشش کریں۔');
        } finally {
            likeBtn.disabled = false;
        }
    });
}

// ============================================
// ✅ COMMENTS SECTION
// ============================================
function formatCommentDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ✅ اسی device کے لیے ایک مستقل گمنام شناخت (user_id) — کوئی login نہیں، صرف اسی browser میں یاد رہتی ہے
function getDeviceUserId() {
    let uid = localStorage.getItem('tr_user_id');
    if (!uid) {
        uid = 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('tr_user_id', uid);
    }
    return uid;
}

async function setupComments(video) {
    const listEl = document.getElementById('commentsList');
    const formEl = document.getElementById('commentForm');
    const errorEl = document.getElementById('commentError');
    if (!listEl || !formEl) return;

    // ✅ device پر پہلے سے لکھا نام یاد رکھیں تاکہ بار بار نہ لکھنا پڑے
    const savedName = localStorage.getItem('tr_comment_name');
    if (savedName) document.getElementById('commentName').value = savedName;

    async function loadComments() {
        try {
            const comments = await supabase.get('comments', { video_id: `eq.${video.id}`, order: 'created_at.desc' });
            if (!comments || comments.length === 0) {
                listEl.innerHTML = `<p style="color:#888; font-size:0.9rem;">ابھی کوئی comment نہیں — سب سے پہلے آپ لکھیں!</p>`;
            } else {
                listEl.innerHTML = comments.map(c => `
                    <div style="padding:10px 0; border-bottom:1px solid #eee;">
                        <div style="display:flex; justify-content:space-between; align-items:baseline;">
                            <strong style="font-size:0.9rem;">${escapeHtml(c.user_name)}</strong>
                            <span style="font-size:0.75rem; color:#888;">${formatCommentDate(c.created_at)}</span>
                        </div>
                        <div style="font-size:0.9rem; margin-top:4px; word-break:break-word;">${escapeHtml(c.comment)}</div>
                    </div>
                `).join('');
            }
        } catch (e) {
            listEl.innerHTML = `<p style="color:#888; font-size:0.9rem;">Comments لوڈ نہیں ہو سکے۔</p>`;
        }
    }

    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.textContent = '';
        const name = document.getElementById('commentName').value.trim();
        const text = document.getElementById('commentText').value.trim();

        if (!name || !text) { errorEl.textContent = 'براہ مہربانی نام اور comment دونوں لکھیں۔'; return; }
        if (/https?:\/\/|www\./i.test(text)) { errorEl.textContent = '❌ Comment میں لنک شامل کرنے کی اجازت نہیں۔'; return; }

        // ✅ Rate limit: اسی ویڈیو پر 60 سیکنڈ میں دوبارہ comment نہ ہو
        const lastTime = parseInt(localStorage.getItem(`tr_last_comment_${video.id}`) || '0');
        if (Date.now() - lastTime < 60000) {
            errorEl.textContent = '⏳ براہ مہربانی تھوڑا انتظار کریں پھر دوبارہ comment کریں۔';
            return;
        }

        const submitBtn = formEl.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        try {
            await supabase.post('comments', { video_id: video.id, user_id: getDeviceUserId(), user_name: name, comment: text });
            localStorage.setItem('tr_comment_name', name);
            localStorage.setItem(`tr_last_comment_${video.id}`, Date.now().toString());
            document.getElementById('commentText').value = '';
            await loadComments();
        } catch (err) {
            errorEl.textContent = '❌ Comment پوسٹ نہیں ہو سکا، دوبارہ کوشش کریں۔';
        } finally {
            submitBtn.disabled = false;
        }
    });

    await loadComments();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}



let reelsHistoryPushed = false;
let reelsObserver = null;
let reelsMuted = true;

function openReelsView() {
    const view = document.getElementById('reelsView');
    const container = document.getElementById('reelsContainer');
    const reels = state.videos.filter(v => v.is_reel && v.published !== false);

    if (reels.length === 0) {
        container.innerHTML = `<div class="reel-empty-msg">🎬 ابھی کوئی Reel شامل نہیں کی گئی۔<br>Admin پینل سے کسی ویڈیو کو "Mark as Reel" کریں۔</div>`;
    } else {
        container.innerHTML = reels.map((v) => {
            const isVideoTag = v.embed_code && v.embed_code.trim().startsWith('<video');
            let mediaHtml = '';
            if (isVideoTag) {
                const srcMatch = v.embed_code.match(/src="([^"]+)"/);
                const posterMatch = v.embed_code.match(/poster="([^"]+)"/);
                const src = srcMatch ? srcMatch[1] : '';
                const poster = posterMatch ? posterMatch[1] : '';
                mediaHtml = `<video class="reel-media" data-src="${src}" playsinline loop poster="${poster}"></video>`;
            } else {
                const embedUrl = extractEmbedUrl(v.embed_code);
                mediaHtml = `<iframe class="reel-media" data-src="${embedUrl}" allow="autoplay; fullscreen" allowfullscreen sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
            }
            return `
                <div class="reel-slide" data-video-id="${v.id}">
                    ${mediaHtml}
                    <div class="reel-info">${v.title || ''}</div>
                </div>
            `;
        }).join('') + `<button class="reel-mute-btn" id="reelMuteBtn">${reelsMuted ? '🔇' : '🔊'}</button>`;

        setupReelsObserver();

        document.getElementById('reelMuteBtn').onclick = () => {
            reelsMuted = !reelsMuted;
            document.getElementById('reelMuteBtn').textContent = reelsMuted ? '🔇' : '🔊';
            const activeSlide = container.querySelector('.reel-slide.reel-active');
            if (activeSlide) activateReelSlide(activeSlide); // نئی mute state کے ساتھ دوبارہ چلائیں
        };
    }

    view.classList.add('active');
    // ✅ Back Button Fix اسی طرح جیسے ویڈیو modal میں
    if (!reelsHistoryPushed) {
        history.pushState({ trendyReelsView: true }, '');
        reelsHistoryPushed = true;
    }
}

function closeReelsView(fromPopstate = false) {
    const view = document.getElementById('reelsView');
    view.classList.remove('active');
    document.querySelectorAll('#reelsContainer .reel-media').forEach(el => {
        if (el.tagName === 'VIDEO') el.pause();
        else if (el.tagName === 'IFRAME') el.src = 'about:blank';
    });
    if (reelsObserver) { reelsObserver.disconnect(); reelsObserver = null; }
    if (reelsHistoryPushed) {
        reelsHistoryPushed = false;
        if (!fromPopstate) history.back();
    }
}

function activateReelSlide(slideEl) {
    const media = slideEl.querySelector('.reel-media');
    if (!media) return;
    if (media.tagName === 'VIDEO') {
        if (!media.src) media.src = media.dataset.src;
        media.muted = reelsMuted;
        media.play().catch(() => {});
    } else if (media.tagName === 'IFRAME') {
        const baseUrl = media.dataset.src;
        const sep = baseUrl.includes('?') ? '&' : '?';
        media.src = `${baseUrl}${sep}autoplay=1&mute=${reelsMuted ? 1 : 0}`;
    }
    // ✅ Watch History میں شامل کریں
    const vid = state.videos.find(v => v.id == slideEl.dataset.videoId);
    if (vid) addToHistory(vid);
}

function deactivateReelSlide(slideEl) {
    const media = slideEl.querySelector('.reel-media');
    if (!media) return;
    if (media.tagName === 'VIDEO') media.pause();
    else if (media.tagName === 'IFRAME') media.src = 'about:blank';
}

function setupReelsObserver() {
    const container = document.getElementById('reelsContainer');
    const slides = container.querySelectorAll('.reel-slide');
    if (reelsObserver) reelsObserver.disconnect();
    reelsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
                slides.forEach(s => s.classList.remove('reel-active'));
                entry.target.classList.add('reel-active');
                activateReelSlide(entry.target);
            } else {
                deactivateReelSlide(entry.target);
            }
        });
    }, { threshold: [0, 0.6, 1] });
    slides.forEach(s => reelsObserver.observe(s));
    if (slides[0]) { slides[0].classList.add('reel-active'); activateReelSlide(slides[0]); }
}



function addToHistory(video) {
    let history = JSON.parse(localStorage.getItem('trendyreels_history') || '[]');
    history = history.filter(v => v.id !== video.id);
    history.unshift({ id: video.id, title: video.title, embed_code: video.embed_code, thumbnail: getThumbnail(video.embed_code) });
    if (history.length > 5) history = history.slice(0, 5);
    localStorage.setItem('trendyreels_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const section = document.getElementById('historySection');
    const grid = document.getElementById('historyGrid');
    if (!section || !grid) return;
    const history = JSON.parse(localStorage.getItem('trendyreels_history') || '[]');
    if (history.length === 0) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    grid.innerHTML = history.map(v => `
        <div class="history-item" onclick="openModernVideoModal(state.videos.find(x => x.id === ${v.id}))">
            <img class="history-thumb" src="${v.thumbnail || 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'160\' height=\'90\'><rect fill=\'%23ccc\'/></svg>'}" alt="${v.title}">
            <div class="history-title">${v.title || 'Untitled'}</div>
        </div>
    `).join('');
}

// ============================================
// NEW: AUTO-COMPLETE SEARCH
// ============================================

function initAutoComplete() {
    const searchInput = document.getElementById('searchInput');
    const suggestions = document.getElementById('searchSuggestions');
    if (!searchInput || !suggestions) return;

    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        if (query.length < 3) {
            suggestions.style.display = 'none';
            return;
        }
        const matches = state.videos.filter(v => v.title.toLowerCase().includes(query)).slice(0, 6);
        if (matches.length === 0) {
            suggestions.style.display = 'none';
            return;
        }
        suggestions.innerHTML = matches.map(v => `
            <div class="search-suggestion-item" onclick="openModernVideoModal(state.videos.find(x => x.id === ${v.id})); document.getElementById('searchSuggestions').style.display='none'">
                ${v.title}
            </div>
        `).join('');
        suggestions.style.display = 'block';
    });

    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !suggestions.contains(e.target)) {
            suggestions.style.display = 'none';
        }
    });
}

// ============================================
// NEW: NATIVE SHARE (Mobile browser share menu)
// ============================================

function nativeShare(text, url) {
    if (navigator.share) {
        navigator.share({ title: 'TrendyReels', text: text, url: url }).catch(() => {});
        return true;
    }
    return false;
}

// ============================================
// NEW: COPY LINK
// ============================================

function copyVideoLink(url) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => alert('✅ Link copied!')).catch(() => alert('❌ Failed to copy.'));
    } else {
        // Fallback
        const dummy = document.createElement('input');
        dummy.value = url;
        document.body.appendChild(dummy);
        dummy.select();
        document.execCommand('copy');
        document.body.removeChild(dummy);
        alert('✅ Link copied!');
    }
}

// ============================================
// ✅ UNIVERSAL TRANSPARENT PLAYER — YouTube + Dailymotion + Native <video>
// ============================================

// --- Official Player APIs کو ایک بار لوڈ کریں (بار بار لوڈ نہ ہو) ---
let ytApiPromise = null;
function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve) => {
        const prevCallback = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (prevCallback) prevCallback(); resolve(); };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    });
    return ytApiPromise;
}

let dmApiPromise = null;
function loadDailymotionAPI() {
    if (window.DM && window.DM.player) return Promise.resolve();
    if (dmApiPromise) return dmApiPromise;
    dmApiPromise = new Promise((resolve) => {
        const tag = document.createElement('script');
        tag.src = 'https://api.dmcdn.net/all.js';
        tag.onload = () => {
            if (window.dailymotion && window.dailymotion.then) {
                window.dailymotion.then(() => { window.DM = window.DM || {}; window.DM.player = window.dailymotion.createPlayer; resolve(); });
            } else {
                // پرانا all.js عالمی DM.player خودکار بناتا ہے
                const check = setInterval(() => {
                    if (window.DM && window.DM.player) { clearInterval(check); resolve(); }
                }, 50);
                setTimeout(() => { clearInterval(check); resolve(); }, 4000); // ✅ حد سے زیادہ انتظار نہ کرے
            }
        };
        document.head.appendChild(tag);
    });
    return dmApiPromise;
}

// --- ویڈیو کہاں کی ہے (YouTube/Dailymotion/Native/Unknown) پہچانیں ---
function getVideoProvider(embedCode) {
    if (!embedCode) return { type: 'other' };
    if (embedCode.trim().startsWith('<video')) return { type: 'native' };
    const ytMatch = embedCode.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) return { type: 'youtube', id: ytMatch[1] };
    const dmMatch = embedCode.match(/dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/);
    if (dmMatch) return { type: 'dailymotion', id: dmMatch[1] };
    return { type: 'other' }; // ✅ نامعلوم پلیٹ فارم — محفوظ fallback (اپنے native کنٹرولز کے ساتھ)
}

// --- ہر پلیٹ فارم کے لیے ایک جیسا "adapter" — تاکہ کنٹرول بٹنز کا کوڈ صرف ایک بار لکھا جائے ---
function createNativeAdapter(videoEl) {
    return {
        type: 'native',
        supportsPiP: true,
        play: () => videoEl.play(),
        pause: () => videoEl.pause(),
        isPaused: () => videoEl.paused,
        setPlaybackRate: (r) => videoEl.playbackRate = r,
        getCurrentTime: () => videoEl.currentTime || 0,
        getDuration: () => videoEl.duration || 0,
        seekTo: (t) => videoEl.currentTime = t,
        setMuted: (m) => videoEl.muted = m,
        isMuted: () => videoEl.muted,
        setLoop: (l) => videoEl.loop = l,
        requestPiP: () => videoEl.requestPictureInPicture().catch(() => {}),
        usesRealTimeEvents: true,
        onPlay: (cb) => videoEl.addEventListener('play', cb),
        onPause: (cb) => videoEl.addEventListener('pause', cb),
        onTimeUpdate: (cb) => videoEl.addEventListener('timeupdate', cb),
        destroy: () => { videoEl.pause(); }
    };
}

function createYouTubeAdapter(ytPlayer) {
    return {
        type: 'youtube',
        supportsPiP: false,
        play: () => ytPlayer.playVideo(),
        pause: () => ytPlayer.pauseVideo(),
        isPaused: () => ytPlayer.getPlayerState() !== 1,
        setPlaybackRate: (r) => ytPlayer.setPlaybackRate(r),
        getCurrentTime: () => ytPlayer.getCurrentTime() || 0,
        getDuration: () => ytPlayer.getDuration() || 0,
        seekTo: (t) => ytPlayer.seekTo(t, true),
        setMuted: (m) => m ? ytPlayer.mute() : ytPlayer.unMute(),
        isMuted: () => ytPlayer.isMuted(),
        setLoop: (l) => { ytPlayer._loop = l; },
        requestPiP: () => {},
        usesRealTimeEvents: false, // ✅ polling سے وقت اپڈیٹ ہوگا
        destroy: () => { try { ytPlayer.destroy(); } catch (e) {} }
    };
}

function createDailymotionAdapter(dmPlayer) {
    return {
        type: 'dailymotion',
        supportsPiP: false,
        play: () => dmPlayer.play(),
        pause: () => dmPlayer.pause(),
        isPaused: () => !!dmPlayer.paused,
        setPlaybackRate: (r) => { if (typeof dmPlayer.setPlaybackSpeed === 'function') dmPlayer.setPlaybackSpeed(r); },
        getCurrentTime: () => dmPlayer.currentTime || 0,
        getDuration: () => dmPlayer.duration || 0,
        seekTo: (t) => { if (typeof dmPlayer.seek === 'function') dmPlayer.seek(t); },
        setMuted: (m) => { if (typeof dmPlayer.setMuted === 'function') dmPlayer.setMuted(m); },
        isMuted: () => !!dmPlayer.muted,
        setLoop: (l) => { dmPlayer._loop = l; },
        requestPiP: () => {},
        usesRealTimeEvents: false, // ✅ polling سے وقت اپڈیٹ ہوگا
        destroy: () => { try { dmPlayer.destroy(); } catch (e) {} }
    };
}

// ✅ فعال پلیئر کو track کریں تاکہ modal بند ہونے پر روکا/destroy کیا جا سکے
let activeUniversalAdapter = null;
let activeProgressPoller = null;

function stopActiveUniversalPlayer() {
    if (activeProgressPoller) { clearInterval(activeProgressPoller); activeProgressPoller = null; }
    if (activeUniversalAdapter) { try { activeUniversalAdapter.pause(); activeUniversalAdapter.destroy(); } catch (e) {} activeUniversalAdapter = null; }
}

// ============================================
// OPEN MODERN VIDEO MODAL (with all new features)
// ============================================

function openModernVideoModal(video) {
    const modal = document.getElementById('videoModal');
    modal.classList.add('active');
    openModalHistoryGuard(); // ✅ Back Button Fix
    stopActiveUniversalPlayer(); // ✅ پچھلی ویڈیو کا پلیئر مکمل روک کر صاف کریں

    const player = document.getElementById('videoPlayer');
    const title = document.getElementById('modalVideoTitle');

    // ✅ Add to history
    addToHistory(video);

    const related = state.videos
        .filter(v => v.id !== video.id && v.category === video.category)
        .slice(0, 4);

    const provider = getVideoProvider(video.embed_code);
    const hasCustomControls = (provider.type === 'native' || provider.type === 'youtube' || provider.type === 'dailymotion');

    let playerHtml = '';
    if (provider.type === 'native') {
        playerHtml = video.embed_code;
    } else if (provider.type === 'youtube') {
        playerHtml = `<div id="universalPlayerTarget"></div>`;
    } else if (provider.type === 'dailymotion') {
        playerHtml = `<div id="universalPlayerTarget"></div>`;
    } else {
        // ✅ نامعلوم پلیٹ فارم — محفوظ fallback: پلیٹ فارم کے اپنے اصل کنٹرولز، کوئی نقلی overlay نہیں
        const embedUrl = extractEmbedUrl(video.embed_code);
        playerHtml = `<iframe src="${embedUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" allow="fullscreen" loading="lazy" frameborder="0" allowfullscreen></iframe>`;
    }

    let relatedHtml = '';
    if (related.length > 0) {
        relatedHtml = `
            <div style="margin-top:20px; border-top:1px solid #eee; padding-top:15px;">
                <h4 style="margin-bottom:10px; font-size:1rem;">Related Videos</h4>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:10px;">
                    ${related.map(v => `
                        <div onclick="openModernVideoModal(state.videos.find(x => x.id === ${v.id}))" style="cursor:pointer; border:1px solid #eee; border-radius:6px; overflow:hidden; background:white;">
                            <img src="${getThumbnail(v.embed_code)}" style="width:100%; height:90px; object-fit:cover;">
                            <div style="padding:6px; font-size:0.75rem; font-weight:500; text-align:center;">${v.title || 'Untitled'}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // ✅ COMPLETE YouTube-style Controls — اب Native/YouTube/Dailymotion تینوں پر حقیقتاً کام کرتے ہیں
    const controlsHtml = `
        <div class="yt-controls-overlay" id="ytControlsOverlay">
            <div style="display:flex; gap:12px; align-items:center; width:100%; justify-content:space-between;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <button class="yt-btn" id="playPauseBtn" style="background:transparent; border:none; color:white; font-size:22px; cursor:pointer; padding:4px 8px; line-height:1; opacity:0.9; transition:opacity 0.2s;">▶</button>
                    <button class="yt-btn" id="muteBtn" style="background:transparent; border:none; color:white; font-size:18px; cursor:pointer; padding:4px 8px; line-height:1; opacity:0.9;">🔊</button>
                    <select id="speedControl" style="background:rgba(0,0,0,0.5); color:white; border:1px solid rgba(255,255,255,0.3); border-radius:4px; padding:2px 6px; font-size:12px; outline:none; cursor:pointer;">
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1" selected>1x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                    </select>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <button class="yt-btn" id="rotateBtn" style="background:transparent; border:none; color:white; font-size:20px; cursor:pointer; padding:4px 8px; line-height:1; opacity:0.9; transition:opacity 0.2s;">🔄</button>
                    <button class="yt-btn" id="lockBtn" style="background:transparent; border:none; color:white; font-size:20px; cursor:pointer; padding:4px 8px; line-height:1; opacity:0.9; transition:opacity 0.2s;">🔒</button>
                    <button class="yt-btn" id="fullscreenBtn" style="background:transparent; border:none; color:white; font-size:20px; cursor:pointer; padding:4px 8px; line-height:1; opacity:0.9; transition:opacity 0.2s;">⛶</button>
                    <button class="yt-btn" id="pipBtn" style="background:transparent; border:none; color:white; font-size:20px; cursor:pointer; padding:4px 8px; line-height:1; opacity:0.9; transition:opacity 0.2s;">🖼️</button>
                    <button class="yt-btn" id="loopBtn" style="background:transparent; border:none; color:white; font-size:20px; cursor:pointer; padding:4px 8px; line-height:1; opacity:0.9; transition:opacity 0.2s;">🔁</button>
                </div>
            </div>
        </div>
    `;

    // ✅ Progress Bar + Time Display
    const progressHtml = `
        <div class="custom-progress-container" id="customProgressContainer">
            <div class="custom-progress-bar" id="customProgressBar"></div>
        </div>
        <div class="custom-time-display">
            <span id="customCurrentTime">0:00</span>
            <span id="customDuration">0:00</span>
        </div>
    `;

    // ✅ Copy Link button
    const copyLinkHtml = `
        <button id="copyLinkBtn" class="action-btn" style="background:transparent; border:1px solid #666; color:white;">🔗 Copy Link</button>
    `;

    player.innerHTML = `
        <div class="video-player-container" id="videoPlayerContainer">
            <button id="closeModalBtn" style="position:absolute; top:15px; right:15px; background:rgba(0,0,0,0.6); border:none; color:white; font-size:28px; border-radius:50%; width:44px; height:44px; cursor:pointer; z-index:40; line-height:44px; text-align:center;">&times;</button>
            ${playerHtml}
            ${hasCustomControls ? controlsHtml : ''}
            ${hasCustomControls ? progressHtml : ''}
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:10px; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; gap:6px;">
                <button id="prevVideoBtn" class="action-btn">⏪ Prev</button>
                <button id="nextVideoBtn" class="action-btn">Next ⏩</button>
            </div>
            <div style="display:flex; gap:6px;">
                <button id="likeBtn" class="action-btn" style="background:transparent; border:1px solid #666; color:inherit;">👍 <span id="likeCount">${video.likes || 0}</span></button>
                <button id="shareBtn" class="action-btn">📤 Share</button>
                ${video.is_copyright_free ? `<button id="downloadBtn" class="action-btn">⬇ Download</button>` : ''}
                ${copyLinkHtml}
            </div>
        </div>
        ${relatedHtml}
        <div class="comments-section" style="margin-top:20px; border-top:1px solid #eee; padding-top:15px;">
            <h4 style="margin-bottom:10px; font-size:1rem;">💬 Comments</h4>
            <form id="commentForm" style="display:flex; flex-direction:column; gap:8px; margin-bottom:16px;">
                <input type="text" id="commentName" placeholder="آپ کا نام" maxlength="50" required style="padding:8px; border:1px solid #ccc; border-radius:6px;">
                <textarea id="commentText" placeholder="اپنا تبصرہ لکھیں..." maxlength="500" rows="2" required style="padding:8px; border:1px solid #ccc; border-radius:6px; resize:vertical;"></textarea>
                <div id="commentError" style="color:#d32f2f; font-size:0.8rem;"></div>
                <button type="submit" class="action-btn" style="align-self:flex-start;">Post Comment</button>
            </form>
            <div id="commentsList">Loading comments...</div>
        </div>
    `;

    document.getElementById('closeModalBtn').onclick = function() {
        closeVideoModal(); // ✅ مرکزی فنکشن استعمال کریں تاکہ history entry بھی صاف ہو
    };

    // ✅ Like بٹن — اسی device پر ایک بار Like/Unlike یاد رکھا جاتا ہے
    setupLikeButton(video);
    // ✅ Comments لوڈ کریں اور فارم جوڑیں
    setupComments(video);

    // ✅ Adapter بننے کے بعد یونیورسل کنٹرولز جوڑیں (Native/YouTube/Dailymotion تینوں کے لیے ایک ہی فنکشن)
    if (provider.type === 'native') {
        const videoEl = player.querySelector('video');
        activeUniversalAdapter = createNativeAdapter(videoEl);
        setupUniversalControls(activeUniversalAdapter);
    } else if (provider.type === 'youtube') {
        loadYouTubeAPI().then(() => {
            if (!document.getElementById('universalPlayerTarget')) return; // ✅ اتنی دیر میں modal بند ہو چکا ہو تو کچھ نہ کریں
            const ytPlayer = new YT.Player('universalPlayerTarget', {
                videoId: provider.id,
                playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3 },
                events: {
                    onReady: () => {
                        activeUniversalAdapter = createYouTubeAdapter(ytPlayer);
                        setupUniversalControls(activeUniversalAdapter);
                    },
                    onStateChange: (e) => {
                        const playPauseBtn = document.getElementById('playPauseBtn');
                        if (!playPauseBtn) return;
                        if (e.data === 1) playPauseBtn.textContent = '⏸';
                        else if (e.data === 2) playPauseBtn.textContent = '▶';
                        else if (e.data === 0) { // ✅ ویڈیو ختم
                            if (ytPlayer._loop) { ytPlayer.seekTo(0, true); ytPlayer.playVideo(); }
                        }
                    }
                }
            });
        });
    } else if (provider.type === 'dailymotion') {
        loadDailymotionAPI().then(() => {
            if (!document.getElementById('universalPlayerTarget')) return;
            DM.player('universalPlayerTarget', {
                video: provider.id,
                params: { controls: false, autoplay: false, 'sharing-enable': false, ui_start_screen_info: false }
            }).then((dmPlayer) => {
                dmPlayer.addEventListener('apiready', () => {
                    activeUniversalAdapter = createDailymotionAdapter(dmPlayer);
                    setupUniversalControls(activeUniversalAdapter);
                });
                dmPlayer.addEventListener('play', () => { const b = document.getElementById('playPauseBtn'); if (b) b.textContent = '⏸'; });
                dmPlayer.addEventListener('pause', () => { const b = document.getElementById('playPauseBtn'); if (b) b.textContent = '▶'; });
                dmPlayer.addEventListener('video_end', () => { if (dmPlayer._loop) { dmPlayer.seek(0); dmPlayer.play(); } });
            }).catch(() => {});
        });
    }

    // ✅ یونیورسل کنٹرولز جوڑنے والا مشترکہ فنکشن — Native/YouTube/Dailymotion تینوں کے لیے ایک ہی جگہ
    function setupUniversalControls(adapter) {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const muteBtn = document.getElementById('muteBtn');
        const speedControl = document.getElementById('speedControl');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const rotateBtn = document.getElementById('rotateBtn');
        const lockBtn = document.getElementById('lockBtn');
        const pipBtn = document.getElementById('pipBtn');
        const loopBtn = document.getElementById('loopBtn');
        const progressContainer = document.getElementById('customProgressContainer');
        const progressBar = document.getElementById('customProgressBar');
        const currentTimeDisplay = document.getElementById('customCurrentTime');
        const durationDisplay = document.getElementById('customDuration');
        const videoContainer = document.getElementById('videoPlayerContainer');
        if (!playPauseBtn || !videoContainer) return;

        let loopEnabled = false;

        playPauseBtn.addEventListener('click', () => {
            if (adapter.isPaused()) { adapter.play(); playPauseBtn.textContent = '⏸'; }
            else { adapter.pause(); playPauseBtn.textContent = '▶'; }
        });

        muteBtn.addEventListener('click', () => {
            const nowMuted = !adapter.isMuted();
            adapter.setMuted(nowMuted);
            muteBtn.textContent = nowMuted ? '🔇' : '🔊';
        });

        speedControl.addEventListener('change', function() { adapter.setPlaybackRate(parseFloat(this.value)); });

        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                videoContainer.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen();
            }
        });

        // ✅ Rotate/Lock صرف یوزر خود دبائے تو landscape lock ہو (خودکار نہیں — پہلے یہی زوم/سائز خراب ہونے کی وجہ تھی)
        rotateBtn.addEventListener('click', () => {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').then(() => {
                    rotateBtn.style.color = '#4CAF50'; rotateBtn.textContent = '🔓';
                }).catch(() => {});
            }
        });
        lockBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) videoContainer.requestFullscreen().catch(() => {});
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').then(() => {
                    lockBtn.style.color = '#4CAF50'; lockBtn.textContent = '🔓';
                }).catch(() => {});
            }
        });

        // ✅ PiP صرف native video پر دستیاب ہے (YouTube/Dailymotion iframe پر ممکن نہیں)
        if (adapter.supportsPiP) {
            pipBtn.addEventListener('click', () => {
                if (document.pictureInPictureElement) document.exitPictureInPicture();
                else adapter.requestPiP();
            });
        } else {
            pipBtn.style.display = 'none';
        }

        loopBtn.addEventListener('click', () => {
            loopEnabled = !loopEnabled;
            adapter.setLoop(loopEnabled);
            loopBtn.style.color = loopEnabled ? '#4CAF50' : 'white';
        });

        // ✅ Progress bar پر کلک کر کے seek کریں
        progressContainer.addEventListener('click', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            const duration = adapter.getDuration();
            if (duration > 0) adapter.seekTo(pos * duration);
        });

        // ✅ وقت اپڈیٹ — native میں اصل ایونٹ، YouTube/Dailymotion میں polling (چونکہ وہ مسلسل ایونٹ نہیں دیتے)
        function updateProgressUI() {
            const duration = adapter.getDuration();
            const current = adapter.getCurrentTime();
            if (duration > 0) {
                progressBar.style.width = ((current / duration) * 100) + '%';
                currentTimeDisplay.textContent = formatTime(current);
                durationDisplay.textContent = formatTime(duration);
            }
        }
        if (adapter.usesRealTimeEvents) {
            adapter.onTimeUpdate(updateProgressUI);
        } else {
            if (activeProgressPoller) clearInterval(activeProgressPoller);
            activeProgressPoller = setInterval(updateProgressUI, 500);
        }

        // ✅ Double-click سے 10 سیکنڈ آگے/پیچھے (سب اقسام پر یکساں)
        videoContainer.addEventListener('dblclick', (e) => {
            const rect = videoContainer.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const current = adapter.getCurrentTime();
            adapter.seekTo(x > rect.width / 2 ? current + 10 : Math.max(0, current - 10));
        });

        // ✅ Auto-hide controls
        const controlsOverlay = document.getElementById('ytControlsOverlay');
        let hideTimer;
        function showControls() {
            controlsOverlay.style.opacity = '1';
            progressContainer.style.opacity = '1';
            clearTimeout(hideTimer);
            if (!adapter.isPaused()) {
                hideTimer = setTimeout(() => {
                    controlsOverlay.style.opacity = '0';
                    progressContainer.style.opacity = '0';
                }, 3000);
            }
        }
        videoContainer.addEventListener('click', showControls);
        videoContainer.addEventListener('touchstart', showControls);
        if (adapter.type === 'native') {
            adapter.onPlay(showControls);
            adapter.onPause(() => { controlsOverlay.style.opacity = '1'; progressContainer.style.opacity = '1'; clearTimeout(hideTimer); });
        }
    }

    document.getElementById('prevVideoBtn').addEventListener('click', () => {
        const prev = getAdjacentVideo('prev');
        if (prev) openModernVideoModal(prev);
        else alert('No previous video.');
    });

    document.getElementById('nextVideoBtn').addEventListener('click', () => {
        const next = getAdjacentVideo('next');
        if (next) openModernVideoModal(next);
        else alert('No next video.');
    });

    // ✅ NEW: Native Share + Copy Link
    document.getElementById('shareBtn').addEventListener('click', () => {
        const text = `Check out "${video.title}" on TrendyReels!`;
        const url = window.location.href;
        if (nativeShare(text, url)) return;
        // Fallback to old prompt
        const shareMenu = prompt(`Share via:\n1. WhatsApp\n2. Facebook\n3. Twitter (X)\n4. Copy Link`, '1');
        if (shareMenu === '1') {
            window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
        } else if (shareMenu === '2') {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, '_blank');
        } else if (shareMenu === '3') {
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
        } else if (shareMenu === '4') {
            navigator.clipboard.writeText(url).then(() => alert('Link copied!')).catch(() => alert('Failed to copy link.'));
        }
    });

    document.getElementById('copyLinkBtn').addEventListener('click', () => {
        copyVideoLink(window.location.href);
    });

    if (video.is_copyright_free) {
        document.getElementById('downloadBtn').addEventListener('click', () => {
            if (video.embed_code.trim().startsWith('<video')) {
                const srcMatch = video.embed_code.match(/src="([^"]+)"/);
                if (srcMatch) window.open(srcMatch[1], '_blank');
            } else {
                const embedUrl = extractEmbedUrl(video.embed_code);
                const ytMatch = embedUrl.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
                if (ytMatch) {
                    window.open(`https://www.youtube.com/watch?v=${ytMatch[1]}`, '_blank');
                } else {
                    window.open(embedUrl, '_blank');
                }
            }
        });
    }

    title.textContent = video.title || 'Untitled Video';
    state.currentVideo = video;
}

// ============================================
// INITIALIZE AUTO-COMPLETE + HISTORY ON PAGE LOAD
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initAutoComplete();
    renderHistory();
});
