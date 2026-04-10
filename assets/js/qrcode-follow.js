;(function () {
  'use strict';

  const img = document.getElementById('qrcode-cursor-follow');
  const content = document.querySelector('.wrap');
  const title = document.querySelector('.site-title');
  const footer = document.querySelector('.site-footer');
  if (!img || !content || !title || !footer) return;

  const GAP = 10;
  let mode = null;
  let lastEvent = null;

  function sizePx() {
    const w = content.getBoundingClientRect().width;
    return Math.max(48, Math.round(w * 0.3));
  }

  function position(e) {
    if (!e || !mode) return;
    const s = sizePx();
    img.style.width = s + 'px';
    img.style.height = s + 'px';

    let left;
    let top;
    if (mode === 'br') {
      left = e.clientX + GAP;
      top = e.clientY + GAP;
    } else {
      left = e.clientX + GAP;
      top = e.clientY - s - GAP;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    left = Math.max(8, Math.min(left, vw - s - 8));
    top = Math.max(8, Math.min(top, vh - s - 8));
    img.style.left = left + 'px';
    img.style.top = top + 'px';
  }

  function show(m, e) {
    mode = m;
    img.hidden = false;
    img.setAttribute('aria-hidden', 'false');
    lastEvent = e;
    position(e);
  }

  function hide() {
    mode = null;
    lastEvent = null;
    img.hidden = true;
    img.setAttribute('aria-hidden', 'true');
  }

  function onMove(e) {
    if (!mode) return;
    lastEvent = e;
    position(e);
  }

  title.addEventListener('mouseenter', function (e) {
    show('br', e);
  });
  title.addEventListener('mouseleave', hide);
  title.addEventListener('mousemove', onMove);

  footer.addEventListener('mouseenter', function (e) {
    show('tr', e);
  });
  footer.addEventListener('mouseleave', hide);
  footer.addEventListener('mousemove', onMove);

  window.addEventListener(
    'resize',
    function () {
      if (mode && lastEvent) position(lastEvent);
    },
    { passive: true }
  );
})();
