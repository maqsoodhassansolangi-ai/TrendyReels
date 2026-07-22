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
// OPEN MODERN VIDEO MODAL (with all new features)
// ============================================

function openModernVideoModal(video) {
    const modal = document.getElementById('videoModal');
    modal.classList.add('active');

    const player = document.getElementById('videoPlayer');
    const title = document.getElementById('modalVideoTitle');

    // ✅ Add to history
    addToHistory(video);

    const related = state.videos
        .filter(v => v.id !== video.id && v.category === video.category)
        .slice(0, 4);

    let playerHtml = '';
    if (video.embed_code.trim().startsWith('<video')) {
        playerHtml = video.embed_code;
    } else {
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

    // ✅ COMPLETE YouTube-style Controls (Play/Pause + All others) - FULLY TRANSPARENT
    const controlsHtml = `
        <div class="yt-controls-overlay" id="ytControlsOverlay">
            <div style="display:flex; gap:12px; align-items:center; width:100%; justify-content:space-between;">
                <div style="display:flex; gap:12px; align-items:center;">
                    <button class="yt-btn" id="playPauseBtn" style="background:transparent; border:none; color:white; font-size:22px; cursor:pointer; padding:4px 8px; line-height:1; opacity:0.9; transition:opacity 0.2s;">▶</button>
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

    // ✅ NEW: Progress Bar + Time Display
    const progressHtml = `
        <div class="custom-progress-container" id="customProgressContainer">
            <div class="custom-progress-bar" id="customProgressBar"></div>
        </div>
        <div class="custom-time-display">
            <span id="customCurrentTime">0:00</span>
            <span id="customDuration">0:00</span>
        </div>
    `;

    // ✅ NEW: Copy Link button
    const copyLinkHtml = `
        <button id="copyLinkBtn" class="action-btn" style="background:transparent; border:1px solid #666; color:white;">🔗 Copy Link</button>
    `;

    player.innerHTML = `
        <div class="video-player-container" id="videoPlayerContainer">
            <button id="closeModalBtn" style="position:absolute; top:15px; right:15px; background:rgba(0,0,0,0.6); border:none; color:white; font-size:28px; border-radius:50%; width:44px; height:44px; cursor:pointer; z-index:40; line-height:44px; text-align:center;">&times;</button>
            ${playerHtml}
            ${controlsHtml}
            ${progressHtml}
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:10px; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; gap:6px;">
                <button id="prevVideoBtn" class="action-btn">⏪ Prev</button>
                <button id="nextVideoBtn" class="action-btn">Next ⏩</button>
            </div>
            <div style="display:flex; gap:6px;">
                <button id="shareBtn" class="action-btn">📤 Share</button>
                ${video.is_copyright_free ? `<button id="downloadBtn" class="action-btn">⬇ Download</button>` : ''}
                ${copyLinkHtml}
            </div>
        </div>
        ${relatedHtml}
    `;

    document.getElementById('closeModalBtn').onclick = function() {
        document.getElementById('videoModal').classList.remove('active');
        document.getElementById('videoPlayer').innerHTML = '';
    };

    const videoEl = player.querySelector('video');

    if (videoEl) {
        // ✅ NEW: Play/Pause Button
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

        videoEl.addEventListener('play', () => {
            playPauseBtn.textContent = '⏸';
        });
        videoEl.addEventListener('pause', () => {
            playPauseBtn.textContent = '▶';
        });

        // ✅ Speed Control
        document.getElementById('speedControl').addEventListener('change', function() {
            videoEl.playbackRate = parseFloat(this.value);
        });

        // ✅ Fullscreen
        document.getElementById('fullscreenBtn').addEventListener('click', function() {
            const container = document.getElementById('videoPlayerContainer');
            if (!document.fullscreenElement) {
                container.requestFullscreen().catch(err => {});
                if (screen.orientation && screen.orientation.lock) {
                    screen.orientation.lock('landscape').catch(() => {});
                }
            } else {
                document.exitFullscreen();
                if (screen.orientation && screen.orientation.unlock) {
                    screen.orientation.unlock();
                }
            }
        });

        // ✅ Rotate Button
        document.getElementById('rotateBtn').addEventListener('click', function() {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').then(() => {
                    document.getElementById('rotateBtn').style.color = '#4CAF50';
                    document.getElementById('rotateBtn').textContent = '🔓';
                }).catch(() => {});
            }
        });

        // ✅ Lock Button
        document.getElementById('lockBtn').addEventListener('click', function() {
            if (!document.fullscreenElement) {
                const container = document.getElementById('videoPlayerContainer');
                container.requestFullscreen().catch(() => {});
            }
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').then(() => {
                    document.getElementById('lockBtn').style.color = '#4CAF50';
                    document.getElementById('lockBtn').textContent = '🔓';
                }).catch(() => {});
            }
        });

        // ✅ PiP Button
        document.getElementById('pipBtn').addEventListener('click', function() {
            if (videoEl) {
                if (document.pictureInPictureElement) {
                    document.exitPictureInPicture();
                } else {
                    videoEl.requestPictureInPicture().catch(() => {});
                }
            }
        });

        // ✅ Loop Button
        document.getElementById('loopBtn').addEventListener('click', function() {
            videoEl.loop = !videoEl.loop;
            document.getElementById('loopBtn').style.color = videoEl.loop ? '#4CAF50' : 'white';
        });

        // ✅ Existing: Double-click forward/backward
        videoEl.addEventListener('dblclick', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x > rect.width / 2) {
                this.currentTime += 10;
            } else {
                this.currentTime -= 10;
            }
        });

        // ✅ NEW: Auto-Rotate on open (simulated click)
        setTimeout(() => {
            const fakeEvent = new MouseEvent('click', { bubbles: true });
            document.getElementById('rotateBtn')?.dispatchEvent(fakeEvent);
        }, 150);

        // ✅ NEW: Progress Bar + Time Display logic
        const progressContainer = document.getElementById('customProgressContainer');
        const progressBar = document.getElementById('customProgressBar');
        const currentTimeDisplay = document.getElementById('customCurrentTime');
        const durationDisplay = document.getElementById('customDuration');

        videoEl.addEventListener('loadedmetadata', () => {
            durationDisplay.textContent = formatTime(videoEl.duration);
        });

        videoEl.addEventListener('timeupdate', () => {
            if (!isNaN(videoEl.duration) && videoEl.duration > 0) {
                const percent = (videoEl.currentTime / videoEl.duration) * 100;
                progressBar.style.width = percent + '%';
                currentTimeDisplay.textContent = formatTime(videoEl.currentTime);
                durationDisplay.textContent = formatTime(videoEl.duration);
            }
        });

        progressContainer.addEventListener('click', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            videoEl.currentTime = pos * videoEl.duration;
        });

        // ✅ NEW: Auto-hide controls
        const controlsOverlay = document.getElementById('ytControlsOverlay');
        const videoContainer = document.getElementById('videoPlayerContainer');
        let hideTimer;

        function showControls() {
            controlsOverlay.style.opacity = '1';
            progressContainer.style.opacity = '1';
            clearTimeout(hideTimer);
            if (!videoEl.paused) {
                hideTimer = setTimeout(() => {
                    controlsOverlay.style.opacity = '0';
                    progressContainer.style.opacity = '0';
                }, 3000);
            }
        }

        videoContainer.addEventListener('click', showControls);
        videoContainer.addEventListener('touchstart', showControls);
        videoEl.addEventListener('play', showControls);
        videoEl.addEventListener('pause', () => {
            controlsOverlay.style.opacity = '1';
            progressContainer.style.opacity = '1';
            clearTimeout(hideTimer);
        });
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
// ============================================
// REELS / SHORTS VIEWER (ALL VIDEOS AS REELS)
// ============================================

let reelsQueue = [];
let currentReelIndex = 0;
let touchStartY = 0;
let touchStartTime = 0;
let isSwiping = false;

// Open Reels Modal
document.getElementById('reelsToggleBtn').addEventListener('click', function() {
    // ساری ویڈیوز کو ریلز کی قطار میں ڈال دیں
    reelsQueue = state.videos.filter(v => v.embed_code && v.embed_code.trim() !== '');
    if (reelsQueue.length === 0) {
        alert('No videos available for Reels.');
        return;
    }
    // ترتیب ویسے ہی رکھیں جیسے سائٹ پر ہے (یا چاہیں تو رینڈم کر سکتے ہیں)
    currentReelIndex = 0;
    document.getElementById('reelsModal').classList.add('active');
    loadReel(0);
});

// Close Reels Modal
document.getElementById('closeReelsBtn').addEventListener('click', function() {
    document.getElementById('reelsModal').classList.remove('active');
    document.getElementById('reelsPlayer').innerHTML = '';
});

// Load a specific reel
function loadReel(index) {
    if (reelsQueue.length === 0) return;
    if (index < 0) index = reelsQueue.length - 1;
    if (index >= reelsQueue.length) index = 0;
    currentReelIndex = index;
    
    const video = reelsQueue[index];
    const player = document.getElementById('reelsPlayer');
    const title = document.getElementById('reelsTitle');
    const category = document.getElementById('reelsCategory');
    
    player.innerHTML = '';
    
    let embedHtml = '';
    if (video.embed_code.trim().startsWith('<video')) {
        embedHtml = video.embed_code;
    } else {
        const embedUrl = extractEmbedUrl(video.embed_code);
        embedHtml = `<iframe src="${embedUrl}" allow="fullscreen" loading="lazy" frameborder="0" allowfullscreen></iframe>`;
    }
    player.innerHTML = embedHtml;
    
    title.textContent = video.title || 'Untitled';
    category.textContent = video.category || 'Uncategorized';
    
    const downloadBtn = document.getElementById('reelsDownloadBtn');
    if (video.is_copyright_free) {
        downloadBtn.style.display = 'flex';
        downloadBtn.onclick = function() {
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
        };
    } else {
        downloadBtn.style.display = 'none';
    }
}

// ============================================
// SWIPE LOGIC (Up/Down)
// ============================================

const reelsContainer = document.getElementById('reelsContainer');

reelsContainer.addEventListener('touchstart', function(e) {
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    isSwiping = false;
});

reelsContainer.addEventListener('touchmove', function(e) {
    const deltaY = e.touches[0].clientY - touchStartY;
    if (Math.abs(deltaY) > 20) {
        isSwiping = true;
    }
});

reelsContainer.addEventListener('touchend', function(e) {
    if (!isSwiping) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;
    
    if (Math.abs(deltaY) > 50 || deltaTime < 300) {
        if (deltaY < 0) {
            loadReel(currentReelIndex + 1);
        } else if (deltaY > 0) {
            loadReel(currentReelIndex - 1);
        }
    }
    isSwiping = false;
});

// Mouse drag support for desktop
let mouseStartY = 0;
let isMouseDown = false;

reelsContainer.addEventListener('mousedown', function(e) {
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
// REELS ACTION BUTTONS (Like, Comment, Share)
// ============================================

document.getElementById('reelsLikeBtn').addEventListener('click', function() {
    const currentVideo = reelsQueue[currentReelIndex];
    if (!currentVideo) return;
    const likedVideos = JSON.parse(localStorage.getItem('trendyreels_liked') || '[]');
    const index = likedVideos.indexOf(currentVideo.id);
    if (index === -1) {
        likedVideos.push(currentVideo.id);
        this.style.color = '#FF0000';
        this.textContent = '❤️';
    } else {
        likedVideos.splice(index, 1);
        this.style.color = 'white';
        this.textContent = '👍';
    }
    localStorage.setItem('trendyreels_liked', JSON.stringify(likedVideos));
});

document.getElementById('reelsCommentBtn').addEventListener('click', function() {
    const comment = prompt('Write a comment:');
    if (comment && comment.trim() !== '') {
        alert('✅ Comment posted: "' + comment.trim() + '"');
    }
});

document.getElementById('reelsShareBtn').addEventListener('click', function() {
    const video = reelsQueue[currentReelIndex];
    if (!video) return;
    const text = `Check out "${video.title}" on TrendyReels!`;
    const url = window.location.href;
    
    if (navigator.share) {
        navigator.share({ title: 'TrendyReels', text: text, url: url }).catch(() => {});
    } else {
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
    }
});

// ============================================
// AUTO-PLAY on load
// ============================================

const origLoadReel = loadReel;
loadReel = function(index) {
    origLoadReel(index);
    setTimeout(() => {
        const iframe = document.querySelector('#reelsPlayer iframe');
        const video = document.querySelector('#reelsPlayer video');
        if (iframe) {
            iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        }
        if (video) {
            video.play().catch(() => {});
        }
    }, 500);
};
