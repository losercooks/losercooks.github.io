;(function () {
    'use strict';
  
    // --- GET ELEMENTS ---
    const body = document.body;
    const SEARCH_URL = body.getAttribute('data-search-json');
  
    const searchOverlay = document.getElementById('search-overlay');
    const searchPanel = document.getElementById('search-panel');
    const input = document.getElementById('search-input');
    const listEl = document.getElementById('search-results');
    const countEl = document.getElementById('search-count');
    const searchOpenBtn = document.getElementById('search-open-btn');
  
    const navOverlay = document.getElementById('site-nav-overlay');
    const navPanel = document.getElementById('site-nav-panel');
    const navOpenBtn = document.getElementById('site-nav-open-btn');
    const navEnabled = !!(navOverlay && navPanel);
  
    if (!SEARCH_URL || !searchOverlay || !searchPanel || !input || !listEl || !countEl) {
      console.error('Search or Nav UI elements are missing from the DOM.');
      return;
    }
  
    // --- THEME --- 
    const themeKey = 'theme-preference';
    function applyTheme(theme) {
      body.classList.toggle('dark-mode', theme === 'dark');
    }
    function toggleTheme() {
      const currentTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
      localStorage.setItem(themeKey, currentTheme);
      applyTheme(currentTheme);
    }
    applyTheme(localStorage.getItem(themeKey));
  
    // --- SEARCH AND MODAL LOGIC ---
    let index = [];
    let indexLoadPromise = null;
    let activeIndex = -1;
    let searchOpen = false;
    let navOpen = false;
    let lastCtrlKeydownForModalMs = 0;
  
    const normalize = (s) => (s || '').toLowerCase();
    const normalizeEntryUrl = (rel) => {
        try { const u = new URL(rel, 'http://localhost'); return u.pathname + u.search + u.hash; }
        catch (e) { return rel; }
    }
    function loadIndex() {
      if (indexLoadPromise) return indexLoadPromise;
      indexLoadPromise = fetch(SEARCH_URL)
        .then(r => r.ok ? r.json() : Promise.reject('search.json'))
        .then(data => {
          index = (Array.isArray(data) ? data : []).map(entry => ({...entry, url: normalizeEntryUrl(entry.url), titleLower: normalize(entry.title)}));
        })
        .catch(() => { index = []; indexLoadPromise = null; });
      return indexLoadPromise;
    }
    function render(q) {
      const query = normalize(q).trim();
      const items = (query ? index.filter(e => e.titleLower.includes(query)) : index.slice(0, 20)).slice(0, 50);
      activeIndex = items.length ? 0 : -1;
      listEl.innerHTML = items.map((entry, i) =>
        `<li class="modal--search__item ${i === 0 ? 'marked' : ''}" role="option" data-url="${entry.url}" id="search-opt-${i}">${entry.title}</li>`
      ).join('');
      countEl.textContent = items.length ? `${query ? items.length : index.length} 条结果` : (query ? '无结果' : '');
      searchPanel.classList.toggle('has-dropdown', items.length > 0 || (query && items.length === 0));
      input.setAttribute('aria-activedescendant', items.length ? 'search-opt-0' : null);
    }
    function setMarked(next) {
      const children = listEl.children;
      if (!children.length) return;
      activeIndex = (next + children.length) % children.length;
      Array.from(children).forEach((el, i) => el.classList.toggle('marked', i === activeIndex));
      const cur = children[activeIndex];
      if (cur) input.setAttribute('aria-activedescendant', cur.id);
    }
    function navigate() {
      const cur = listEl.querySelector('li.marked');
      if (cur) window.location.assign(cur.getAttribute('data-url'));
    }
    function setBodyModalOpen() {
      body.classList.toggle('modal--search--open', searchOpen);
      body.classList.toggle('modal--site-nav--open', navOpen);
    }
    function openNavModal() {
      if (!navEnabled || navOpen) return;
      closeSearchModal(true); navOpen = true;
      navOverlay.classList.add('showOverlay'); navPanel.classList.add('is-open');
      if (navOpenBtn) navOpenBtn.setAttribute('aria-expanded', 'true');
      setBodyModalOpen();
      const firstLink = navPanel.querySelector('a');
      if (firstLink) requestAnimationFrame(() => firstLink.focus());
    }
    function closeNavModal() {
      if (!navEnabled || !navOpen) return;
      navOpen = false; lastCtrlKeydownForModalMs = 0;
      navOverlay.classList.remove('showOverlay'); navPanel.classList.remove('is-open');
      if (navOpenBtn) navOpenBtn.setAttribute('aria-expanded', 'false');
      setBodyModalOpen();
    }
    function openSearchModal() {
      if (searchOpen) return;
      if (navEnabled) closeNavModal();
      searchOpen = true;
      loadIndex().then(() => {
        searchOverlay.classList.add('showOverlay'); searchPanel.classList.add('is-open');
        if (searchOpenBtn) searchOpenBtn.setAttribute('aria-expanded', 'true');
        input.value = ''; render('');
        setBodyModalOpen();
        requestAnimationFrame(() => input.focus());
      });
    }
    function closeSearchModal(silent) {
      if (!searchOpen) return;
      searchOpen = false;
      searchOverlay.classList.remove('showOverlay'); searchPanel.classList.remove('is-open');
      if (searchOpenBtn) searchOpenBtn.setAttribute('aria-expanded', 'false');
      setBodyModalOpen();
    }
  
    // --- ROBUST SHORTCUT HANDLER ---
    let ctrlClickTimer = null;
    let ctrlClickCount = 0;
    const multiClickDelay = 200;
  
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Control' && !e.repeat) {
        e.preventDefault();
        if (searchOpen || navOpen) {
          const now = Date.now();
          if (now - lastCtrlKeydownForModalMs < multiClickDelay + 50) {
            if (navOpen) closeNavModal(); else closeSearchModal();
          }
          lastCtrlKeydownForModalMs = now;
          return;
        }
        ctrlClickCount++;
        if (ctrlClickTimer) clearTimeout(ctrlClickTimer);
        if (ctrlClickCount >= 3) {
          toggleTheme();
          ctrlClickCount = 0;
        } else {
          ctrlClickTimer = setTimeout(() => {
            if (ctrlClickCount === 1) openSearchModal();
            else if (ctrlClickCount === 2) openNavModal();
            ctrlClickCount = 0;
          }, multiClickDelay);
        }
      }
      if (e.key === 'Escape') {
        if (navOpen) { e.preventDefault(); closeNavModal(); }
        else if (searchOpen) { e.preventDefault(); closeSearchModal(); }
      }
    });
  
    // --- EVENT LISTENERS ---
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMarked(activeIndex + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setMarked(activeIndex - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); navigate(); }
    });
    listEl.addEventListener('click', e => {
      const li = e.target.closest('li[data-url]');
      if (li) navigate();
    });
    listEl.addEventListener('mouseover', e => {
      const li = e.target.closest('li[id^="search-opt-"]');
      if (li) setMarked(parseInt(li.id.replace('search-opt-', ''), 10));
    });
  
    if (searchOpenBtn) searchOpenBtn.addEventListener('click', () => openSearchModal());
    if (navEnabled && navOpenBtn) navOpenBtn.addEventListener('click', () => openNavModal());
    searchOverlay.addEventListener('click', () => closeSearchModal());
    if (navEnabled) navOverlay.addEventListener('click', () => closeNavModal());
    
    // Prefetch search index
    setTimeout(loadIndex, 500);
  
  })();
  