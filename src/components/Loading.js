import imgBubbles from '../assets/clawd/IMG_bubbles.GIF';
import imgCelebrate from '../assets/clawd/IMG_celebrate.GIF';
import imgIdea from '../assets/clawd/IMG_idea.GIF';
import imgLove from '../assets/clawd/IMG_love.GIF';
import imgMusic from '../assets/clawd/IMG_music.GIF';
import imgRepair from '../assets/clawd/IMG_repair.GIF';
import imgThinking from '../assets/clawd/IMG_thinking.GIF';
import imgWatch from '../assets/clawd/IMG_watch.GIF';
import { t } from '../i18n.js';

const CLAWD_GIFS = [imgBubbles, imgCelebrate, imgIdea, imgLove, imgMusic, imgRepair, imgThinking, imgWatch];
const CLAWD_CAPTIONS = () => [t('loading.bubbles'), t('loading.celebrate'), t('loading.idea'), t('loading.love'), t('loading.music'), t('loading.repair'), t('loading.thinking'), t('loading.watch')];

export function showLoading(container) {
  const idx = Math.floor(Math.random() * CLAWD_GIFS.length);
  const overlay = document.createElement('div');
  overlay.className = 'clawd-loading-overlay';
  overlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg-primary);z-index:100;transition:opacity 0.3s ease;';

  const img = document.createElement('img');
  img.src = CLAWD_GIFS[idx];
  img.alt = 'Clawd loading';
  img.style.cssText = 'width:80px;height:80px;image-rendering:pixelated;';

  const caption = document.createElement('div');
  caption.style.cssText = 'margin-top:12px;font-size:0.8rem;color:var(--text-muted);font-weight:500;';
  caption.textContent = CLAWD_CAPTIONS()[idx];

  overlay.appendChild(img);
  overlay.appendChild(caption);
  container.style.position = 'relative';
  container.appendChild(overlay);
  return overlay;
}

export function hideLoading(overlay) {
  if (!overlay) return;
  overlay.style.opacity = '0';
  setTimeout(() => overlay.remove(), 300);
}
