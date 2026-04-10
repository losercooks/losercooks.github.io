;(function () {
  'use strict';

  const SEARCH_URL = document.body.getAttribute('data-search-json');
  if (!SEARCH_URL) return;

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

  if (!searchOverlay || !searchPanel || !input || !listEl || !countEl) return;

  const PREVIEW_LIMIT = 20;
  const RESULT_LIMIT = 50;
  const DOUBLE_CTRL_MS = 320;
  const SINGLE_CTRL_DELAY_MS = 280;

  /** 大屏下顶栏按钮可能被 CSS 隐藏，勿对不可见元素 focus */
  function focusTriggerIfVisible(btn) {
    if (!btn) return;
    const rects = btn.getClientRects();
    if (!rects || rects.length === 0) return;
    btn.focus();
  }

  /**
   * 站内相对路径统一经 URL 解析再跳转，避免中文路径在部分浏览器/WEBrick 下
   * 以错误编码请求导致 404（地址栏出现 ä¸Š 类乱码）。
   */
  function navigateToSiteUrl(url) {
    if (!url) return;
    try {
      window.location.assign(new URL(url, window.location.origin).href);
    } catch (e) {
      window.location.assign(url);
    }
  }

  /** 将 search.json 里的相对路径规范为 pathname+search+hash，避免混用编码形式 */
  function normalizeEntryUrl(rel) {
    if (!rel || typeof rel !== 'string') return rel;
    try {
      const u = new URL(rel, 'http://localhost');
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return rel;
    }
  }

  let index = [];
  /** fetch / JSON 解析失败时为 true，用于提示用户而非与「无文章」混淆 */
  let indexLoadError = false;
  let indexLoadPromise = null;
  let activeIndex = -1;
  let searchOpen = false;
  let navOpen = false;

  let ctrlUsedWithOtherKey = false;
  let ignoreNextCtrlKeyup = false;
  let ignoreCtrlKeyupsRemaining = 0;
  let openSearchPending = false;

  /** 未打开弹层时：两次 Ctrl keydown 间隔，用于打开导航 */
  let lastCtrlKeydownMs = 0;
  /** 搜索/导航已打开时：两次 Ctrl keydown 间隔，用于关闭 */
  let lastCtrlKeydownForModalMs = 0;
  let singleCtrlTimer = null;
  let inputRenderRaf = null;
  let ignoreInputBlur = false;

  const normalize = (s) => (s || '').toLowerCase();
  const SEARCH_INDEX_ERROR_MSG = '索引加载失败，请刷新重试';

  /** 只发起一次 fetch；失败清空 promise 以便重试 */
  function loadIndex() {
    if (indexLoadPromise) return indexLoadPromise;
    indexLoadPromise = fetch(SEARCH_URL, { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('search.json');
        return r.json();
      })
      .then((data) => {
        indexLoadError = false;
        const arr = Array.isArray(data) ? data : [];
        index = arr.map((entry) => {
          if (!entry || typeof entry.url !== 'string') return entry;
          return {
            ...entry,
            url: normalizeEntryUrl(entry.url),
            titleLower: normalize(entry.title),
          };
        });
        return index;
      })
      .catch(() => {
        indexLoadError = true;
        index = [];
        indexLoadPromise = null;
        return index;
      });
    return indexLoadPromise;
  }

  function render(q) {
    if (indexLoadError) {
      listEl.innerHTML = '';
      countEl.textContent = SEARCH_INDEX_ERROR_MSG;
      countEl.classList.add('modal--search__count--error');
      searchPanel.classList.add('has-dropdown');
      if (input) input.removeAttribute('aria-activedescendant');
      return;
    }
    countEl.classList.remove('modal--search__count--error');

    const query = normalize(q).trim();
    let items;
    if (query) {
      items = index.filter((entry) => {
        const tl =
          entry.titleLower != null
            ? entry.titleLower
            : normalize(entry.title);
        return tl.indexOf(query) !== -1;
      });
    } else {
      items = index.slice(0, PREVIEW_LIMIT);
    }
    activeIndex = items.length ? 0 : -1;

    const frag = document.createDocumentFragment();
    const slice = items.slice(0, RESULT_LIMIT);
    for (let i = 0; i < slice.length; i += 1) {
      const entry = slice[i];
      const li = document.createElement('li');
      li.className = 'modal--search__item';
      li.setAttribute('role', 'option');
      li.setAttribute('data-url', entry.url);
      li.id = `search-opt-${i}`;
      if (i === 0) li.classList.add('marked');
      li.textContent = entry.title;
      li.addEventListener('mouseenter', () => {
        if (i !== activeIndex) {
          activeIndex = i;
          setMarked(i);
        }
      });
      frag.appendChild(li);
    }
    listEl.innerHTML = '';
    listEl.appendChild(frag);

    const n = items.length;
    if (query && n === 0) countEl.textContent = '无结果';
    else if (n) countEl.textContent = `${n} 条结果`;
    else countEl.textContent = '';

    if (input && listEl.children.length) {
      input.setAttribute('aria-activedescendant', listEl.children[0].id);
    } else if (input) {
      input.removeAttribute('aria-activedescendant');
    }

    const showDropdown = (query && n === 0) || n > 0;
    searchPanel.classList.toggle('has-dropdown', showDropdown);
  }

  function scheduleRenderFromInput() {
    const q = input.value;
    if (inputRenderRaf) cancelAnimationFrame(inputRenderRaf);
    inputRenderRaf = requestAnimationFrame(() => {
      inputRenderRaf = null;
      render(q);
    });
  }

  function setMarked(next) {
    const children = listEl.children;
    if (!children.length) return;
    let n = next;
    if (n < 0) n = children.length - 1;
    if (n >= children.length) n = 0;
    activeIndex = n;
    for (let i = 0; i < children.length; i += 1) {
      children[i].classList.toggle('marked', i === activeIndex);
    }
    const cur = children[activeIndex];
    if (cur && input) input.setAttribute('aria-activedescendant', cur.id);
  }

  function navigate() {
    const cur = listEl.querySelector('li.marked');
    if (!cur) return;
    const url = cur.getAttribute('data-url');
    navigateToSiteUrl(url);
  }

  const isControlKey = (e) =>
    e.key === 'Control' || e.code === 'ControlLeft' || e.code === 'ControlRight';

  function clearSingleCtrlTimer() {
    if (singleCtrlTimer) {
      clearTimeout(singleCtrlTimer);
      singleCtrlTimer = null;
    }
  }

  function setBodyModalOpen() {
    document.body.classList.toggle('modal--search--open', searchOpen);
    document.body.classList.toggle('modal--site-nav--open', navOpen);
  }

  function openNavModal() {
    if (!navEnabled) return;
    clearSingleCtrlTimer();
    closeSearchModal(true);
    if (navOpen) return;
    navOpen = true;
    navOverlay.classList.add('showOverlay');
    navOverlay.removeAttribute('hidden');
    navOverlay.setAttribute('aria-hidden', 'false');
    navPanel.classList.add('is-open');
    navPanel.removeAttribute('hidden');
    navPanel.setAttribute('aria-hidden', 'false');
    if (navOpenBtn) navOpenBtn.setAttribute('aria-expanded', 'true');
    const firstLink = navPanel.querySelector('a');
    setBodyModalOpen();
    if (firstLink) requestAnimationFrame(() => firstLink.focus());
  }

  function closeNavModal() {
    if (!navEnabled || !navOpen) return;
    clearSingleCtrlTimer();
    lastCtrlKeydownForModalMs = 0;
    navOpen = false;
    navOverlay.classList.remove('showOverlay');
    navOverlay.setAttribute('hidden', '');
    navOverlay.setAttribute('aria-hidden', 'true');
    navPanel.classList.remove('is-open');
    navPanel.setAttribute('hidden', '');
    navPanel.setAttribute('aria-hidden', 'true');
    if (navOpenBtn) navOpenBtn.setAttribute('aria-expanded', 'false');
    setBodyModalOpen();
    focusTriggerIfVisible(navOpenBtn);
  }

  function openSearchModal() {
    if (searchOpen || openSearchPending) return;
    if (navEnabled) closeNavModal();
    openSearchPending = true;
    loadIndex().then(() => {
      openSearchPending = false;
      if (searchOpen) return;
      searchOpen = true;
      searchOverlay.classList.add('showOverlay');
      searchOverlay.removeAttribute('hidden');
      searchOverlay.setAttribute('aria-hidden', 'false');
      searchPanel.classList.add('is-open');
      searchPanel.removeAttribute('hidden');
      searchPanel.setAttribute('aria-hidden', 'false');
      if (searchOpenBtn) searchOpenBtn.setAttribute('aria-expanded', 'true');
      ignoreNextCtrlKeyup = true;
      // 第一次点击只显示输入框；直到 input 获得焦点再渲染下拉结果
      listEl.innerHTML = '';
      activeIndex = -1;
      if (indexLoadError) {
        countEl.textContent = SEARCH_INDEX_ERROR_MSG;
        countEl.classList.add('modal--search__count--error');
        searchPanel.classList.add('has-dropdown');
      } else {
        countEl.textContent = '';
        countEl.classList.remove('modal--search__count--error');
        searchPanel.classList.remove('has-dropdown');
      }
      setBodyModalOpen();
    });
  }

  /** @param {boolean} [silent] 不抢焦点（被导航打开时关闭搜索） */
  function closeSearchModal(silent) {
    clearSingleCtrlTimer();
    ignoreNextCtrlKeyup = false;
    openSearchPending = false;
    lastCtrlKeydownForModalMs = 0;
    if (!searchOpen) return;
    searchOpen = false;
    searchOverlay.classList.remove('showOverlay');
    searchOverlay.setAttribute('hidden', '');
    searchOverlay.setAttribute('aria-hidden', 'true');
    searchPanel.classList.remove('is-open');
    searchPanel.setAttribute('hidden', '');
    searchPanel.setAttribute('aria-hidden', 'true');
    if (searchOpenBtn) searchOpenBtn.setAttribute('aria-expanded', 'false');
    input.value = '';
    listEl.innerHTML = '';
    countEl.textContent = '';
    countEl.classList.remove('modal--search__count--error');
    activeIndex = -1;
    searchPanel.classList.remove('has-dropdown');
    setBodyModalOpen();
    if (!silent) focusTriggerIfVisible(searchOpenBtn);
  }

  function onCtrlKeyDown(e) {
    if (e.key === 'Escape') {
      if (navOpen) {
        e.preventDefault();
        closeNavModal();
        return;
      }
      if (searchOpen) {
        e.preventDefault();
        closeSearchModal();
      }
      return;
    }

    if (isControlKey(e)) {
      if (!e.repeat) ctrlUsedWithOtherKey = false;

      if (navOpen || searchOpen) {
        if (!e.repeat) {
          const nowModal = Date.now();
          if (
            nowModal - lastCtrlKeydownForModalMs < DOUBLE_CTRL_MS &&
            lastCtrlKeydownForModalMs > 0
          ) {
            lastCtrlKeydownForModalMs = 0;
            e.preventDefault();
            if (navOpen) closeNavModal();
            else closeSearchModal();
            ignoreCtrlKeyupsRemaining = 2;
            return;
          }
          lastCtrlKeydownForModalMs = nowModal;
          e.preventDefault();
        }
        return;
      }

      if (!e.repeat) {
        const now = Date.now();
        if (
          navEnabled &&
          now - lastCtrlKeydownMs < DOUBLE_CTRL_MS &&
          lastCtrlKeydownMs > 0
        ) {
          clearSingleCtrlTimer();
          lastCtrlKeydownMs = 0;
          e.preventDefault();
          openNavModal();
          ignoreCtrlKeyupsRemaining = 2;
          return;
        }
        lastCtrlKeydownMs = now;
        clearSingleCtrlTimer();
        singleCtrlTimer = setTimeout(() => {
          singleCtrlTimer = null;
          lastCtrlKeydownMs = 0;
          if (!navOpen && !searchOpen) {
            openSearchModal();
          }
        }, SINGLE_CTRL_DELAY_MS);
        e.preventDefault();
      }
      return;
    }

    if (e.ctrlKey && !isControlKey(e)) {
      ctrlUsedWithOtherKey = true;
      clearSingleCtrlTimer();
      lastCtrlKeydownMs = 0;
      lastCtrlKeydownForModalMs = 0;
    }
  }

  function onCtrlKeyUp(e) {
    if (!isControlKey(e) || e.repeat) return;
    if (ctrlUsedWithOtherKey) {
      ctrlUsedWithOtherKey = false;
      ignoreNextCtrlKeyup = false;
      ignoreCtrlKeyupsRemaining = 0;
      return;
    }
    if (ignoreCtrlKeyupsRemaining > 0) {
      ignoreCtrlKeyupsRemaining -= 1;
      return;
    }
    if (ignoreNextCtrlKeyup) {
      ignoreNextCtrlKeyup = false;
      return;
    }
    /* 关闭弹层已改为双击 Ctrl（keydown），不再在 keyup 上单次关闭 */
  }

  searchOverlay.addEventListener('click', () => {
    closeSearchModal();
  });

  searchPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  if (navEnabled) {
    navOverlay.addEventListener('click', () => {
      closeNavModal();
    });

    navPanel.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  input.addEventListener('input', scheduleRenderFromInput);

  // 只有获得焦点时才展示下拉结果
  input.addEventListener('focus', () => {
    if (!searchOpen) return;
    render(input.value);
  });

  input.addEventListener('blur', () => {
    if (!searchOpen) return;
    if (ignoreInputBlur) return;
    listEl.innerHTML = '';
    activeIndex = -1;
    if (indexLoadError) {
      countEl.textContent = SEARCH_INDEX_ERROR_MSG;
      countEl.classList.add('modal--search__count--error');
      searchPanel.classList.add('has-dropdown');
    } else {
      countEl.textContent = '';
      countEl.classList.remove('modal--search__count--error');
      searchPanel.classList.remove('has-dropdown');
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMarked(activeIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMarked(activeIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      navigate();
    }
  });

  listEl.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li || !listEl.contains(li)) return;
    const url = li.getAttribute('data-url');
    navigateToSiteUrl(url);
  });

  // 点击结果时，避免 blur 触发把下拉清空
  listEl.addEventListener('mousedown', () => {
    ignoreInputBlur = true;
  });
  document.addEventListener('mouseup', () => {
    ignoreInputBlur = false;
  });

  document.addEventListener('keydown', onCtrlKeyDown, true);
  document.addEventListener('keyup', onCtrlKeyUp, true);

  if (searchOpenBtn) {
    searchOpenBtn.addEventListener('click', () => {
      clearSingleCtrlTimer();
      openSearchModal();
    });
  }

  if (navEnabled && navOpenBtn) {
    navOpenBtn.addEventListener('click', () => {
      clearSingleCtrlTimer();
      openNavModal();
    });
  }

  /** 空闲时预取索引，避免抢首屏；timeout 保证长时间忙碌仍会执行 */
  function scheduleIdlePrefetch() {
    const run = () => {
      loadIndex();
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(run, { timeout: 2000 });
    } else {
      setTimeout(run, 1);
    }
  }
  scheduleIdlePrefetch();
})();
