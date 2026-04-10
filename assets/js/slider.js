/**
 * 首页轮播：data-slider 根节点，data-slider-visible 为每屏列数。
 * 图区在左右键之间占满宽度；单列宽 = (内容区宽 − 列缝) / 列数，无上限，与正方形格子同高。
 * --slider-gap / 图区内边距由 CSS 变量提供；翻页用 transform；ResizeObserver 重算。
 */
(function () {
  'use strict';

  /**
   * 与 _sass/_variables.scss 中 $slider-gap（及 .slider 上 --slider-gap）一致，供 cssVarPx 回退。
   * 修改间距时请同时改 SCSS 变量与此处数值。
   */
  const SLIDER_GAP_FALLBACK_PX = 8;

  /** 每个轮播根节点对应灯箱键盘处理；document 上只挂一条 keydown（捕获） */
  const lightboxKeyHandlers = new WeakMap();

  function onDocumentLightboxKeydown(e) {
    const lb = document.querySelector('[data-slider-lightbox]:not([hidden])');
    if (!lb) return;
    const root = lb.closest('[data-slider]');
    if (!root) return;
    const fn = lightboxKeyHandlers.get(root);
    if (typeof fn === 'function') fn(e);
  }

  document.addEventListener('keydown', onDocumentLightboxKeydown, true);

  function parseVisible(root) {
    const n = parseInt(root.getAttribute('data-slider-visible') || '4', 10);
    return !n || n < 1 ? 4 : n;
  }

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function initSlider(root) {
    const visible = parseVisible(root);
    const viewport = root.querySelector('.slider__viewport');
    const track = root.querySelector('[data-slider-track]');
    const prevBtn = root.querySelector('[data-slider-prev]');
    const nextBtn = root.querySelector('[data-slider-next]');
    const lightbox = root.querySelector('[data-slider-lightbox]');
    const lightboxImg = root.querySelector('[data-slider-lightbox-img]');
    const lightboxCaption = root.querySelector('[data-slider-lightbox-caption]');
    const lightboxClose = root.querySelector('[data-slider-lightbox-close]');
    const lightboxBackdrop = root.querySelector('[data-slider-lightbox-backdrop]');
    const lightboxPrev = root.querySelector('[data-slider-lightbox-prev]');
    const lightboxNext = root.querySelector('[data-slider-lightbox-next]');
    if (!viewport || !track || !prevBtn || !nextBtn) return;

    const items = track.children;
    const total = items.length;
    if (!total) return;

    let pageIndex = 0;
    let resizeRaf = null;
    const reduceMotion = prefersReducedMotion();
    let layoutZeroRetries = 0;

    const maxPage = () => Math.max(0, total - visible);

    const cssVarPx = (el, name, fallback) => {
      const s = getComputedStyle(el).getPropertyValue(name).trim();
      const n = parseFloat(s);
      return Number.isNaN(n) ? fallback : n;
    };

    const gapPx = () => {
      const g = cssVarPx(root, '--slider-gap', SLIDER_GAP_FALLBACK_PX);
      if (g > 0) return g;
      const s = getComputedStyle(track).gap || '0';
      const v = parseFloat(s);
      return Number.isNaN(v) ? 0 : v;
    };

    const viewportContentWidth = () => {
      const st = getComputedStyle(viewport);
      const pl = parseFloat(st.paddingLeft) || 0;
      const pr = parseFloat(st.paddingRight) || 0;
      const inner = viewport.clientWidth - pl - pr;
      return inner > 0 ? inner : 0;
    };

    const slideWidthPx = () => {
      const vw = viewportContentWidth();
      const g = gapPx();
      if (vw <= 0) return 0;
      return (vw - (visible - 1) * g) / visible;
    };

    const scheduleResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = null;
        layout();
        sync();
      });
    };

    function layout() {
      const w = slideWidthPx();
      if (!w) {
        if (layoutZeroRetries < 40) {
          layoutZeroRetries += 1;
          requestAnimationFrame(scheduleResize);
        }
        return;
      }
      layoutZeroRetries = 0;
      const g = gapPx();
      for (let i = 0; i < total; i += 1) {
        items[i].style.flex = `0 0 ${w}px`;
        items[i].style.width = `${w}px`;
      }
      track.style.width = `${w * total + (total - 1) * g}px`;
    }

    function sync() {
      const m = maxPage();
      if (pageIndex > m) pageIndex = m;
      if (pageIndex < 0) pageIndex = 0;
      const w = slideWidthPx();
      if (w > 0) {
        const step = w + gapPx();
        track.style.transform = `translate3d(${-pageIndex * step}px, 0, 0)`;
        track.style.transition = reduceMotion ? 'none' : 'transform 0.35s ease';
      }
      const atEnd = m === 0;
      prevBtn.disabled = pageIndex === 0 || atEnd;
      nextBtn.disabled = pageIndex === m || atEnd;
    }

    const setPage = (i) => {
      pageIndex = i;
      sync();
    };

    prevBtn.addEventListener('click', () => {
      setPage(pageIndex - 1);
    });

    nextBtn.addEventListener('click', () => {
      setPage(pageIndex + 1);
    });

    let lightboxOpen = false;
    let lightboxIndex = 0;

    function itemThumbImg(idx) {
      const item = items[idx];
      return item ? item.querySelector('img') : null;
    }

    function itemImgSrc(idx) {
      const img = itemThumbImg(idx);
      return img ? img.getAttribute('src') : '';
    }

    function itemCaption(idx) {
      const img = itemThumbImg(idx);
      if (!img) return '';
      const raw = img.getAttribute('data-slider-caption');
      return raw ? String(raw) : '';
    }

    function clearLightboxCaptionWidth() {
      if (lightboxCaption) lightboxCaption.style.width = '';
    }

    function syncLightboxCaptionWidth() {
      if (!lightboxOpen || !lightboxImg || !lightboxCaption) return;
      if (!itemCaption(lightboxIndex)) return;
      const w = lightboxImg.getBoundingClientRect().width;
      if (w > 0) lightboxCaption.style.width = `${w}px`;
    }

    /** 换源后等一帧再量宽；大图 onload 与 ResizeObserver 会再校正 */
    function queueCaptionWidthSync() {
      if (!lightboxOpen || !itemCaption(lightboxIndex)) return;
      requestAnimationFrame(syncLightboxCaptionWidth);
    }

    function updateLightboxImage() {
      if (!lightboxImg) return;
      const src = itemImgSrc(lightboxIndex);
      if (src) lightboxImg.setAttribute('src', src);
      const cap = itemCaption(lightboxIndex);
      if (lightboxCaption) {
        lightboxCaption.textContent = cap;
        if (cap) {
          lightboxCaption.removeAttribute('hidden');
          lightboxImg.addEventListener('load', queueCaptionWidthSync, { once: true });
          queueCaptionWidthSync();
        } else {
          lightboxCaption.setAttribute('hidden', '');
          clearLightboxCaptionWidth();
        }
      }
      lightboxImg.setAttribute('alt', cap || '');
    }

    function lightboxStep(delta) {
      lightboxIndex = (lightboxIndex + delta + total) % total;
      updateLightboxImage();
    }

    function openLightbox(index) {
      if (!lightbox || total < 1) return;
      lightboxIndex = ((index % total) + total) % total;
      updateLightboxImage();
      lightboxOpen = true;
      lightbox.removeAttribute('hidden');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('slider-lightbox-open');
      if (lightboxClose) lightboxClose.focus();
    }

    function closeLightbox() {
      if (!lightbox || !lightboxOpen) return;
      lightboxOpen = false;
      clearLightboxCaptionWidth();
      lightbox.setAttribute('hidden', '');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('slider-lightbox-open');
    }

    function onLightboxKeydown(e) {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        lightboxStep(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        lightboxStep(1);
      }
    }

    track.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || t.tagName !== 'IMG') return;
      const item = t.closest('.slider__item');
      if (!item || !track.contains(item)) return;
      e.preventDefault();
      const idx = Array.prototype.indexOf.call(items, item);
      if (idx >= 0) openLightbox(idx);
    });

    if (lightboxClose) {
      lightboxClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeLightbox();
      });
    }
    if (lightboxBackdrop) {
      lightboxBackdrop.addEventListener('click', closeLightbox);
    }
    if (lightboxPrev) {
      lightboxPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        lightboxStep(-1);
      });
    }
    if (lightboxNext) {
      lightboxNext.addEventListener('click', (e) => {
        e.stopPropagation();
        lightboxStep(1);
      });
    }
    if (lightbox) {
      lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
      });
    }

    lightboxKeyHandlers.set(root, onLightboxKeydown);

    root.addEventListener('keydown', (e) => {
      if (lightboxOpen) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setPage(pageIndex - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setPage(pageIndex + 1);
      }
    });

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(scheduleResize);
      ro.observe(viewport);
      if (lightboxImg) {
        new ResizeObserver(() => {
          if (lightboxOpen && itemCaption(lightboxIndex)) syncLightboxCaptionWidth();
        }).observe(lightboxImg);
      }
    } else {
      window.addEventListener(
        'resize',
        () => {
          scheduleResize();
          if (lightboxOpen && itemCaption(lightboxIndex)) queueCaptionWidthSync();
        },
        { passive: true }
      );
    }

    layout();
    sync();
    requestAnimationFrame(scheduleResize);

    root.setAttribute('tabindex', '0');
  }

  const sliders = document.querySelectorAll('[data-slider]');
  for (let i = 0; i < sliders.length; i += 1) {
    initSlider(sliders[i]);
  }
})();
