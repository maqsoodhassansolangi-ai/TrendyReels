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
// NEW: WATCH HISTORY (localStorage)
// ============================================

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
        <div class="history-item" onclick="openModernVideoModal(state.videos.find(x => x.id === ${v.id}), true)">
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
            <div class="search-suggestion-item" onclick="openModernVideoModal(state.videos.find(x => x.id === ${v.id}), true); document.getElementById('searchSuggestions').style.display='none'">
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
// OPEN MODERN VIDEO MODAL (NEW REELS MODE WITH SWIPE)
// ============================================

let reelsQueue = [];
let currentReelIndex = 0;
let touchStartY = 0;
let isSwiping = false;

function openModernVideoModal(video, fromReels = true) {
    if (fromReels) {
        // ساری ویڈیوز کو ریلز کی قطار میں ڈالیں
        reelsQueue = state.videos.filter(v => v.id !== video.id);
        reelsQueue.unshift(video); // موجودہ ویڈیو کو پہلے رکھیں
        currentReelIndex = 0;
        
        const modal = document.getElementById('videoModal');
        modal.classList.add('active');
        window.history.pushState({ modalOpen: true }, '');
        loadReel(0);
        return;
    }

    // اگر fromReels = false ہو تو پرانا نارمل موڈ (آپ چاہیں تو استعمال کر سکتے ہیں)
    const modal = document.getElementById('videoModal');
    modal.classList.add('active');
    // پرانا کوڈ یہاں رکھ سکتے ہیں (اگر ضرورت ہو)
}

// ============================================
// LOAD REEL (SINGLE VIDEO WITH SWIPE)
// ============================================

function loadReel(index) {
    if (reelsQueue.length === 0) return;
    if (index < 0) index = reelsQueue.length - 1;
    if (index >= reelsQueue.length) index = 0;
    currentReelIndex = index;
    
    const video = reelsQueue[index];
    const player = document.getElementById('videoPlayer');
    const title = document.getElementById('modalVideoTitle');
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn');
    const copyLinkBtn = document.getElementById('copyLinkBtn');
    
    // پہلے پلیئر کو خالی کریں
    player.innerHTML = '';
    
    // ویڈیو ایمبیڈ کریں
    let embedHtml = '';
    if (video.embed_code.trim().startsWith('<video')) {
        embedHtml = video.embed_code;
    } else {
        const embedUrl = extractEmbedUrl(video.embed_code);
        embedHtml = `<iframe src="${embedUrl}" allow="fullscreen" loading="eager" frameborder="0" allowfullscreen></iframe>`;
    }
    
    // مکمل اسکرین کنٹرولز کے ساتھ پلیئر (9:16 aspect ratio for Reels)
    player.innerHTML = `
        <div class="video-player-container" id="videoPlayerContainer" style="position:relative; width:100%; aspect-ratio:9/16; background:#000; border-radius:8px; overflow:hidden;">
            <button id="closeModalBtn" style="position:absolute; top:15px; right:15px; background:rgba(0,0,0,0.6); border:none; color:white; font-size:28px; border-radius:50%; width:44px; height:44px; cursor:pointer; z-index:40; line-height:44px; text-align:center;">&times;</button>
            ${embedHtml}
            <!-- YouTube-style Controls -->
            <div class="yt-controls-overlay" style="position:absolute; bottom:15px; left:15px; right:15px; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.5); padding:6px 12px; border-radius:30px; z-index:30; backdrop-filter:blur(4px);">
                <div style="display:flex; gap:12px; align-items:center;">
                    <button class="yt-btn" id="playPauseBtn" style="background:transparent; border:none; color:white; font-size:22px; cursor:pointer;">▶</button>
                    <select id="speedControl" style="background:rgba(0,0,0,0.5); color:white; border:1px solid rgba(255,255,255,0.3); border-radius:4px; padding:2px 6px; font-size:12px;">
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1" selected>1x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                    </select>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <button class="yt-btn" id="fullscreenBtn" style="background:transparent; border:none; color:white; font-size:20px; cursor:pointer;">⛶</button>
                </div>
            </div>
        </div>
    `;
    
    // عنوان اور بٹن اپ ڈیٹ کریں
    title.textContent = video.title || 'Untitled';
    shareBtn.style.display = 'inline-block';
    copyLinkBtn.style.display = 'inline-block';
    
    // ڈاؤن لوڈ بٹن (اگر کاپی رائٹ فری ہو)
    if (video.is_copyright_free) {
        downloadBtn.style.display = 'inline-block';
        downloadBtn.onclick = function() {
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
    } else {
        downloadBtn.style.display = 'none';
    }
    
    // شیئر بٹن
    shareBtn.onclick = function() {
        const text = `Check out "${video.title}" on TrendyReels!`;
        const url = window.location.href;
        if (navigator.share) {
            navigator.share({ title: 'TrendyReels', text: text, url: url }).catch(() => {});
        } else {
            window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
        }
    };
    
    // کاپی لنک بٹن
    copyLinkBtn.onclick = function() {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(window.location.href).then(() => alert('✅ Link copied!'));
        } else {
            const dummy = document.createElement('input');
            dummy.value = window.location.href;
            document.body.appendChild(dummy);
            dummy.select();
            document.execCommand('copy');
            document.body.removeChild(dummy);
            alert('✅ Link copied!');
        }
    };
    
    // کلوز بٹن (بیک بٹن بھی کام کرے گا)
    document.getElementById('closeModalBtn').onclick = function() {
        document.getElementById('videoModal').classList.remove('active');
        player.innerHTML = '';
        window.history.back();
    };
    
    // YouTube-style پلے/پاز کنٹرولز (صرف native video کے لیے)
    const videoEl = player.querySelector('video') || player.querySelector('iframe');
    if (videoEl && videoEl.tagName === 'VIDEO') {
        const playPauseBtn = document.getElementById('playPauseBtn');
        playPauseBtn.addEventListener('click', function() {
            if (videoEl.paused) {
                videoEl.play();
                this.textContent = '⏸';
            } else {
                videoEl.pause();
                this.textContent = '▶';
            }
        });
        videoEl.addEventListener('play', () => { playPauseBtn.textContent = '⏸'; });
        videoEl.addEventListener('pause', () => { playPauseBtn.textContent = '▶'; });
        
        document.getElementById('speedControl').addEventListener('change', function() {
            videoEl.playbackRate = parseFloat(this.value);
        });
        
        document.getElementById('fullscreenBtn').addEventListener('click', function() {
            const container = document.getElementById('videoPlayerContainer');
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(() => {});
            } else {
                document.exitFullscreen();
            }
        });
    }
    
    // ============================================
    // SWIPE SUPPORT (Touch + Mouse)
    // ============================================
    
    const container = document.getElementById('videoPlayerContainer');
    
    // Touch swipe
    container.addEventListener('touchstart', function(e) {
        touchStartY = e.touches[0].clientY;
    });
    
    container.addEventListener('touchend', function(e) {
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaY) > 50) {
            if (deltaY < 0) {
                loadReel(currentReelIndex + 1); // اگلی ویڈیو (سوائپ اپ)
            } else if (deltaY > 0) {
                loadReel(currentReelIndex - 1); // پچھلی ویڈیو (سوائپ ڈاؤن)
            }
        }
    });
    
    // Mouse drag (Desktop)
    let mouseStartY = 0;
    let isMouseDown = false;
    container.addEventListener('mousedown', function(e) {
        mouseStartY = e.clientY;
        isMouseDown = true;
    });
    document.addEventListener('mousemove', function(e) {
        if (!isMouseDown) return;
        const deltaY = e.clientY - mouseStartY;
        if (Math.abs(deltaY) > 50) {
            if (deltaY < 0) {
                loadReel(currentReelIndex + 1);
            } else {
                loadReel(currentReelIndex - 1);
            }
            isMouseDown = false;
        }
    });
    document.addEventListener('mouseup', function() {
        isMouseDown = false;
    });
    
    // ============================================
    // PRELOAD NEXT VIDEO (Optimization)
    // ============================================
    
    setTimeout(() => {
        const nextIndex = currentReelIndex + 1;
        if (nextIndex < reelsQueue.length) {
            const nextVideo = reelsQueue[nextIndex];
            const preloader = document.createElement('div');
            preloader.style.display = 'none';
            let nextEmbedHtml = '';
            if (nextVideo.embed_code.trim().startsWith('<video')) {
                nextEmbedHtml = nextVideo.embed_code;
            } else {
                const nextEmbedUrl = extractEmbedUrl(nextVideo.embed_code);
                nextEmbedHtml = `<iframe src="${nextEmbedUrl}" allow="fullscreen" loading="lazy" frameborder="0" allowfullscreen></iframe>`;
            }
            preloader.innerHTML = nextEmbedHtml;
            document.body.appendChild(preloader);
            setTimeout(() => preloader.remove(), 5000);
        }
    }, 100);
}

// ============================================
// BACK BUTTON CLOSE MODAL (Mobile)
// ============================================

document.addEventListener('popstate', function(e) {
    const modal = document.getElementById('videoModal');
    if (modal.classList.contains('active')) {
        modal.classList.remove('active');
        document.getElementById('videoPlayer').innerHTML = '';
        if (!e.state) {
            window.history.pushState(null, '', window.location.href);
        }
    }
});

// ============================================
// INITIALIZE AUTO-COMPLETE + HISTORY ON PAGE LOAD
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    initAutoComplete();
    renderHistory();
});
