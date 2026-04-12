;(function() {
  'use strict';

  const img = document.getElementById('qrcode-cursor-follow');
  if (!img) return;

  const header = document.querySelector('.site-header');
  const footer = document.querySelector('.site-footer');

  if (!header || !footer) return;

  let isLoaded = false;
  let currentTargetElement = null; // To track if mouse is over header or footer

  // --- Start Image Preloading ---
  const imgSrc = img.getAttribute('data-src');
  if (imgSrc) {
    img.src = imgSrc;
    img.onload = () => {
      isLoaded = true;
      img.onerror = null;
    };
    img.onerror = () => {
      const fallback = img.getAttribute('data-qrcode-fallback');
      if (fallback) {
        img.src = fallback;
      }
    };
  }
  // --- End Image Preloading ---


  function show() {
    if (img.hidden) {
      img.hidden = false;
    }
  }

  function hide() {
    if (!img.hidden) {
      img.hidden = true;
    }
  }

  function handleMouseEnter(event) {
    currentTargetElement = event.currentTarget;
    show();
  }

  function handleMouseLeave() {
    currentTargetElement = null;
    hide();
  }

  function follow(event) {
    if (!isLoaded || !currentTargetElement) return;

    const x = event.pageX;
    const y = event.pageY;
    const offset = 15; // Visual offset from the cursor

    if (currentTargetElement === header) {
      // Over header: position QR code to the bottom-right of the cursor
      img.style.transform = `translate(${x + offset}px, ${y + offset}px)`;
    } else if (currentTargetElement === footer) {
      // Over footer: position QR code to the top-right of the cursor
      const imgHeight = img.offsetHeight;
      img.style.transform = `translate(${x + offset}px, ${y - imgHeight - offset}px)`;
    }
  }

  header.addEventListener('mouseenter', handleMouseEnter);
  header.addEventListener('mouseleave', handleMouseLeave);
  footer.addEventListener('mouseenter', handleMouseEnter);
  footer.addEventListener('mouseleave', handleMouseLeave);

  document.body.addEventListener('mousemove', follow);

})();
