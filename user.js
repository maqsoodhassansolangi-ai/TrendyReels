// ============================================
// USER.JS - FINAL PHASE 1 (Auto-Rotate + YouTube-like Controls)
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

function openModernVideoModal(video) {
    const modal = document.getElementById('videoModal');
    modal.classList.add('active');

    const player = document.getElementById('videoPlayer');
    const title = document.getElementById('modalVideoTitle');

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

    // ✅ YouTube-style Controls with Auto-hide
    const controlsHtml = `
        <div class="yt-controls-overlay" id="ytControlsOverlay">
            <div style="display:flex; gap:12px; align-items:center;">
                <select id="speedControl" style="background:transparent; color:white; border:1px solid #888; border-radius:4px; padding:2px 6px; font-size:12px; outline:none;">
                    <option value="0.5">0.5x</option>
                    <option value="0.75">0.75x</option>
                    <option value="1" selected>1x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                </select>
            </div>
            <div style="display:flex; gap:12px; align-items:center;">
                <button class="yt-btn" id="fullscreenBtn" style="background:none; border:none; color:white; font-size:18px; cursor:pointer; padding:0; line-height:1;">⛶</button>
                <button class="yt-btn" id="pipBtn" style="background:none; border:none; color:white; font-size:18px; cursor:pointer; padding:0; line-height:1;">🖼️</button>
                <button class="yt-btn" id="loopBtn" style="background:none; border:none; color:white; font-size:18px; cursor:pointer; padding:0; line-height:1;">🔁</button>
            </div>
        </div>
    `;

    player.innerHTML = `
        <div class="video-player-container" id="videoPlayerContainer">
            <button id="closeModalBtn" style="position:absolute; top:15px; right:15px; background:rgba(0,0,0,0.6); border:none; color:white; font-size:28px; border-radius:50%; width:44px; height:44px; cursor:pointer; z-index:40; line-height:44px; text-align:center;">&times;</button>
            ${playerHtml}
            ${controlsHtml}
        </div>
        <div style="display:flex; justify-content:space-between; margin-top:10px; flex-wrap:wrap; gap:6px;">
            <div style="display:flex; gap:6px;">
                <button id="prevVideoBtn" class="action-btn">⏪ Prev</button>
                <button id="nextVideoBtn" class="action-btn">Next ⏩</button>
            </div>
            <div style="display:flex; gap:6px;">
                <button id="shareBtn" class="action-btn">📤 Share</button>
                ${video.is_copyright_free ? `<button id="downloadBtn" class="action-btn">⬇ Download</button>` : ''}
            </div>
        </div>
        ${relatedHtml}
    `;

    document.getElementById('closeModalBtn').onclick = function() {
        document.getElementById('videoModal').classList.remove('active');
        document.getElementById('videoPlayer').innerHTML = '';
    };

    document.getElementById('speedControl').addEventListener('change', function() {
        const video = player.querySelector('video');
        if (video) video.playbackRate = parseFloat(this.value);
    });

    // ✅ Auto-Rotate on Fullscreen (موبائل کو گھمائے گا)
    document.getElementById('fullscreenBtn').addEventListener('click', function() {
        const container = document.getElementById('videoPlayerContainer');
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {});
            // موبائل کو خود بخود گھمانے کے لیے
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(err => {});
            }
        } else {
            document.exitFullscreen();
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        }
    });

    document.getElementById('pipBtn').addEventListener('click', function() {
        const video = player.querySelector('video');
        if (video) {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture();
            } else {
                video.requestPictureInPicture().catch(err => {});
            }
        }
    });

    document.getElementById('loopBtn').addEventListener('click', function() {
        const video = player.querySelector('video');
        if (video) {
            video.loop = !video.loop;
            document.getElementById('loopBtn').style.color = video.loop ? '#4CAF50' : 'white';
        }
    });

    const videoEl = player.querySelector('video');
    if (videoEl) {
        videoEl.addEventListener('dblclick', function(e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x > rect.width / 2) {
                this.currentTime += 10;
            } else {
                this.currentTime -= 10;
            }
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

    document.getElementById('shareBtn').addEventListener('click', () => {
        const text = `Check out "${video.title}" on TrendyReels!`;
        const url = window.location.href;
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
