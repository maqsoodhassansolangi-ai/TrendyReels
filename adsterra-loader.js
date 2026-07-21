// ============================================
// ADSTERRA LOADER - V1.0
// ============================================

const SUPABASE_URL = 'https://tdbuvlyzgxdkmheocikf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xBiU1V-ZZxLkNF-Yw6dV5A_JEdF4Uig';

async function loadAdsterraAds() {
    try {
        // ایڈ سلاٹس Supabase سے لائیں
        const response = await fetch(`${SUPABASE_URL}/rest/v1/ad_slots?select=*`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const slots = await response.json();

        // ہر سلاٹ کو چیک کریں
        slots.forEach(slot => {
            if (!slot.enabled) return;

            // موبائل یا ڈیسک ٹاپ کا کوڈ چنیں
            const isMobile = window.innerWidth < 768;
            const code = isMobile ? slot.mobileCode : slot.desktopCode;
            if (!code || code.trim() === '') return;

            // ہدف کا HTML عنصر تلاش کریں
            const target = document.getElementById(`ad-slot-${slot.name}`);
            if (!target) return;

            // Adsterra کا کوڈ ڈالیں
            target.innerHTML = code;

            // Adsterra کوڈ میں اگر <script> tags ہوں تو انہیں ایگزیکیوٹ کریں
            const scripts = target.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => {
                    newScript.setAttribute(attr.name, attr.value);
                });
                newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });
        });
    } catch (error) {
        console.warn('Adsterra loading error:', error);
    }
}

// جب صفحہ لوڈ ہو تو رن کریں
document.addEventListener('DOMContentLoaded', loadAdsterraAds);

// جب ونڈو کا سائز تبدیل ہو (موبائل<->ڈیسک ٹاپ) تو دوبارہ لوڈ کریں
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(loadAdsterraAds, 300);
});
