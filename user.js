// ============================================
// USER.JS - FINAL PHASE 1 (Rotate + Lock Buttons)
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

    // ✅ YouTube-style Controls (Transparent + Rotate + Lock)
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
                <button class="yt-btn" id="rotateBtn" style="background:none; border:none; color:white; font-size:18px; cursor:pointer; padding:0; line-height:1;">🔄</button>
                <button class="yt-btn" id="lockBtn" style="background:none; border:none; color:white; font-size:18px; cursor:pointer; padding:0; line-height:1;">🔒</button>
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

    // ✅ Fullscreen (with Auto-Rotate attempt)
    document.getElementById('fullscreenBtn').addEventListener('click', function() {
        const container = document.getElementById('videoPlayerContainer');
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {});
            // براؤزر روٹیٹ کی کوشش کریں
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

    // ✅ Rotate Button (Manual rotate with lock)
    document.getElementById('rotateBtn').addEventListener('click', function() {
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').then(() => {
                document.getElementById('rotateBtn').style.color = '#4CAF50';
                document.getElementById('rotateBtn').textContent = '🔓';
            }).catch(() => {});
        }
    });

    // ✅ Lock Button (Toggle lock)
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

    document.getElementById('pipBtn').addEventListener('click', function() {
        const video = player.querySelector('video');
        if (video) {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture();
            } else {
                video.requestPictureInPicture().catch(() => {});
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

// ============================================
// PHASE 2 - NEW: FRONTEND ADS + MID-ROLL + DOWNLOAD POPUP + AUTO-PLAY
// ============================================

// --- 1. ڈیوائس ڈیٹیکشن ---
function isMobileDevice() {
    return window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent);
}

// --- 2. فرنٹ اینڈ پر ایڈز لوڈ کریں ---
async function loadFrontendAds() {
    const adSlots = state.adSlots;
    if (!adSlots || adSlots.length === 0) return;

    const headerAd = adSlots.find(s => s.name === 'header');
    const sidebarAd = adSlots.find(s => s.name === 'sidebar');

    // ہیڈر ایڈ
    const headerDiv = document.getElementById('header-ad');
    if (headerDiv && headerAd && headerAd.enabled) {
        const code = isMobileDevice() ? headerAd.mobileCode : headerAd.desktopCode;
        if (code) {
            headerDiv.innerHTML = code;
            headerDiv.style.display = 'block';
        }
    }

    // سائیڈبار ایڈ
    const sidebarDiv = document.getElementById('sidebar-ad');
    if (sidebarDiv && sidebarAd && sidebarAd.enabled) {
        const code = isMobileDevice() ? sidebarAd.mobileCode : sidebarAd.desktopCode;
        if (code) {
            sidebarDiv.innerHTML = code;
            sidebarDiv.style.display = 'block';
        }
    }
}

// --- 3. مڈ رول ایڈ (ویڈیو کے دوران) ---
let midRollTimer = null;
let midRollAdShown = false;

function setupMidRollAd(videoElement) {
    if (!videoElement) return;
    midRollAdShown = false;

    videoElement.addEventListener('timeupdate', function() {
        // 30 سیکنڈ پر ایڈ دکھائیں (اگر پہلے نہیں دکھائی گئی)
        if (!midRollAdShown && this.currentTime >= 30) {
            midRollAdShown = true;
            this.pause();

            // ایک عارضی اوورلے بنائیں
            const overlay = document.createElement('div');
            overlay.id = 'midRollOverlay';
            overlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:50; display:flex; flex-direction:column; justify-content:center; align-items:center;';

            // ایڈ کوڈ لوڈ کریں
            const midRollAd = state.adSlots.find(s => s.name === 'video_midroll');
            const adCode = midRollAd && midRollAd.enabled ? (isMobileDevice() ? midRollAd.mobileCode : midRollAd.desktopCode) : '';

            overlay.innerHTML = `
                <div style="background:white; padding:20px; border-radius:12px; max-width:90%; text-align:center;">
                    <h3 style="margin-bottom:15px;">Advertisement</h3>
                    ${adCode || '<p>Ad placeholder</p>'}
                    <button id="skipMidRollBtn" style="margin-top:15px; padding:10px 20px; background:#4CAF50; color:white; border:none; border-radius:6px; cursor:pointer;">Skip Ad</button>
                </div>
            `;

            // اوورلے کو ویڈیو کنٹینر میں شامل کریں
            const container = videoElement.closest('.video-player-container');
            if (container) container.appendChild(overlay);

            // Skip بٹن کا ایونٹ
            document.getElementById('skipMidRollBtn')?.addEventListener('click', function() {
                const overlayEl = document.getElementById('midRollOverlay');
                if (overlayEl) overlayEl.remove();
                videoElement.play();
            });

            // 5 سیکنڈ بعد خود بخود سکپ
            setTimeout(() => {
                const overlayEl = document.getElementById('midRollOverlay');
                if (overlayEl && overlayEl.parentNode) {
                    overlayEl.remove();
                    videoElement.play();
                }
            }, 5000);
        }
    });
}

// --- 4. ڈاؤن لوڈ پاپ اپ ایڈ ---
function showDownloadAdPopup(video) {
    // پاپ اپ بنائیں
    const popup = document.createElement('div');
    popup.id = 'downloadAdPopup';
    popup.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; display:flex; justify-content:center; align-items:center;';

    const downloadAd = state.adSlots.find(s => s.name === 'download_popup');
    const adCode = downloadAd && downloadAd.enabled ? (isMobileDevice() ? downloadAd.mobileCode : downloadAd.desktopCode) : '';

    popup.innerHTML = `
        <div style="background:white; padding:25px; border-radius:16px; max-width:90%; text-align:center; position:relative;">
            <h3 style="margin-bottom:10px;">⏳ Please wait...</h3>
            <p style="margin-bottom:15px; color:#666;">Your video is preparing for download.</p>
            ${adCode || '<div style="padding:20px; background:#f0f0f0; border-radius:8px;">Ad placeholder</div>'}
            <button id="closeDownloadPopupBtn" style="margin-top:15px; padding:10px 25px; background:#2196F3; color:white; border:none; border-radius:6px; cursor:pointer;">Continue</button>
        </div>
    `;

    document.body.appendChild(popup);

    // بٹن کا ایونٹ
    document.getElementById('closeDownloadPopupBtn')?.addEventListener('click', function() {
        const popupEl = document.getElementById('downloadAdPopup');
        if (popupEl) popupEl.remove();
        downloadVideo(video);
    });
}

// --- 5. آٹو پلے (ویڈیو ختم ہونے پر اگلی ویڈیو) ---
function setupAutoPlay(videoElement) {
    if (!videoElement) return;
    videoElement.addEventListener('ended', function() {
        const next = getAdjacentVideo('next');
        if (next) {
            openModernVideoModal(next);
        } else {
            alert('No more videos in this list.');
        }
    });
}

// --- 6. ویڈیو ڈاؤن لوڈ فنکشن ---
function downloadVideo(video) {
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
}

// --- 7. ڈاؤن لوڈ بٹن کو نئے ورژن سے تبدیل کریں ---
document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const current = state.currentVideo;
            if (current && current.is_copyright_free) {
                showDownloadAdPopup(current);
            }
        });
    }
});

// --- 8. init کے اندر ایڈز لوڈ کریں (پہلے سے موجود init کے ساتھ ضم ہو جائے گا) ---
// ہم اسے init کے آخر میں کال کریں گے
