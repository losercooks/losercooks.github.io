
/**
 *
 * 网站全局脚本
 *
 * 主要功能:
 * 1.  **主题管理 (Theme Manager):**
 *     - 在浅色 (light) 和深色 (dark) 模式之间切换。
 *     - 将用户的偏好设置存储在 localStorage 中，以便在后续访问时保持一致。
 *
 * 2.  **弹窗式搜索 (Search Module):**
 *     - 提供一个全屏覆盖的搜索界面。
 *     - 异步加载 `search.json` 文件作为数据源。
 *     - 根据用户输入实时过滤搜索结果。
 *     - 支持键盘上下箭头导航和 Enter键 跳转。
 *     - 鼠标悬停可高亮结果项。
 *     - 优化渲染性能，使用 `requestAnimationFrame` 进行防抖处理。
 *
 * 3.  **弹窗式导航 (Navigation Module):**
 *     - 提供一个从侧边滑出的响应式导航菜单。
 *
 * 4.  **快捷键支持 (Shortcuts):**
 *     - `Ctrl` (单击): 打开搜索。
 *     - `Ctrl` (双击): 打开导航。
 *     - `Ctrl` (三击): 切换主题。
 *     - `Esc`: 关闭当前打开的搜索或导航弹窗。
 *
 * 5.  **状态管理:**
 *     - 使用一个简单的 `state` 对象来跟踪 UI 状态（如搜索/导航是否打开）。
 *
 * 代码结构:
 * - 使用立即执行函数表达式 (IIFE) 封装代码，避免污染全局作用域。
 * - 缓存 DOM 元素的引用以提高性能。
 * - 将相关功能组织成模块 (themeManager, searchModule, navModule)。
 * - 在 `init()` 函数中统一初始化所有功能。
 *
 */
;(function () {
    'use strict';

    // --- A. 缓存 DOM 元素 | CACHE DOM ELEMENTS ---
    // ==========================================================================
    const body = document.body;
    // 搜索相关元素
    const searchOverlay = document.getElementById('search-overlay');
    const searchPanel = document.getElementById('search-panel');
    const input = document.getElementById('search-input');
    const listEl = document.getElementById('search-results');
    const countEl = document.getElementById('search-count');
    const searchOpenBtn = document.getElementById('search-open-btn');

    // 导航相关元素
    const navOverlay = document.getElementById('site-nav-overlay');
    const navPanel = document.getElementById('site-nav-panel');
    const navOpenBtn = document.getElementById('site-nav-open-btn');

    // 从 body 的 data 属性获取 search.json 的路径
    const SEARCH_URL = body.getAttribute('data-search-json');
    // 检查导航元素是否存在，以确定是否启用导航模块
    const navEnabled = !!(navOverlay && navPanel);

    // 如果缺少必要的搜索元素，则在控制台报错并终止执行
    if (!SEARCH_URL || !searchPanel || !input) {
      console.error('Search UI elements are missing from the DOM.');
      return;
    }

    // --- B. 全局状态管理 | STATE MANAGEMENT ---
    // ==========================================================================
    let state = {
        index: [],                 // 存储从 search.json 加载的完整索引数据
        indexLoadPromise: null,    // 用于确保 search.json 只被请求一次的 Promise
        activeIndex: -1,           // 当前在搜索结果中高亮的项的索引
        searchOpen: false,         // 搜索弹窗是否打开
        navOpen: false,            // 导航弹窗是否打开
        renderFrameId: null,       // 用于 requestAnimationFrame 的 ID，实现渲染防抖
    };

    // --- C. 主题管理器 | THEME MANAGER ---
    // ==========================================================================
    const themeManager = {
        key: 'theme-preference', // localStorage 中存储主题偏好的键名
        init() {
            // 初始化时，从 localStorage 读取并应用主题
            this.apply(localStorage.getItem(this.key));
        },
        apply(theme) {
            // 根据主题参数切换 body 的 'dark-mode' 类
            body.classList.toggle('dark-mode', theme === 'dark');
        },
        toggle() {
            // 切换当前主题
            const currentTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
            // 将新主题存入 localStorage
            localStorage.setItem(this.key, currentTheme);
            this.apply(currentTheme);
        }
    };

    // --- D. UI 模块 | UI MODULES ---
    // ==========================================================================

    /**
     * 搜索模块
     * @type {object}
     */
    const searchModule = {
        open() {
            if (state.searchOpen) return;
            if (navEnabled) navModule.close(); // 打开搜索时关闭导航
            state.searchOpen = true;
            this.loadIndex().then(() => { // 确保索引加载完毕
                searchOverlay.classList.add('showOverlay');
                searchPanel.classList.add('is-open');
                if (searchOpenBtn) searchOpenBtn.setAttribute('aria-expanded', 'true');
                input.value = '';
                this.render(''); // 初始渲染（显示最近文章）
                this.updateBodyClass();
                requestAnimationFrame(() => input.focus()); // 自动聚焦输入框
            });
        },
        close() {
            if (!state.searchOpen) return;
            state.searchOpen = false;
            searchOverlay.classList.remove('showOverlay');
            searchPanel.classList.remove('is-open');
            if (searchOpenBtn) searchOpenBtn.setAttribute('aria-expanded', 'false');
            this.updateBodyClass();
        },
        render(q) {
            const query = (q || '').toLowerCase().trim();
            let results;

            // 根据是否有查询词来过滤或获取最新文章
            if (query) {
                results = state.index.filter(e => e.titleLower.includes(query)).slice(0, 50);
            } else {
                results = state.index.slice(0, 20);
            }
            
            state.activeIndex = results.length ? 0 : -1; // 重置高亮索引
            
            // 生成结果列表的 HTML
            listEl.innerHTML = results.map((entry, i) =>
                `<li class="modal--search__item ${i === 0 ? 'marked' : ''}" role="option" data-url="${entry.url}" id="search-opt-${i}">${entry.title}</li>`
            ).join('');
            
            // 更新结果计数（修复了重复数字的 bug 并提高了可读性）
            let countText = '';
            if (query) {
                countText = results.length ? `${results.length} 条结果` : '无结果';
            } else {
                countText = results.length ? `最新 ${results.length} 条结果` : '';
            }
            countEl.textContent = countText;

            // 根据是否有结果来决定是否显示下拉区域的背景
            searchPanel.classList.toggle('has-dropdown', results.length > 0 || (query && results.length === 0));
            // 更新 ARIA 属性，便于屏幕阅读器
            input.setAttribute('aria-activedescendant', results.length ? 'search-opt-0' : null);
        },
        scheduleRender() {
            // 使用 rAF 进行渲染防抖，避免在快速输入时频繁渲染
            if (state.renderFrameId) cancelAnimationFrame(state.renderFrameId);
            state.renderFrameId = requestAnimationFrame(() => {
                this.render(input.value);
                state.renderFrameId = null;
            });
        },
        setMarked(next) {
            const children = listEl.children;
            if (!children.length) return;
            // 循环设置高亮项的索引
            state.activeIndex = (next + children.length) % children.length;
            // 更新所有列表项的 'marked' 类
            Array.from(children).forEach((el, i) => el.classList.toggle('marked', i === state.activeIndex));
            const current = children[state.activeIndex];
            // 更新 ARIA 属性
            if (current) input.setAttribute('aria-activedescendant', current.id);
        },
        navigate() {
            // 跳转到当前高亮项的 URL
            const current = listEl.querySelector('li.marked');
            if (current) window.location.assign(current.getAttribute('data-url'));
        },
        loadIndex() {
            // 如果已经在加载，则返回同一个 Promise
            if (state.indexLoadPromise) return state.indexLoadPromise;
            // 发起 fetch 请求加载 search.json
            state.indexLoadPromise = fetch(SEARCH_URL)
                .then(r => r.ok ? r.json() : Promise.reject('search.json'))
                .then(data => {
                    // 标准化 URL 路径，以防万一
                    const normalizeUrl = (rel) => {
                        try { const u = new URL(rel, 'http://localhost'); return u.pathname + u.search + u.hash; }
                        catch (e) { return rel; }
                    };
                    // 预处理数据，添加小写标题以便不区分大小写搜索
                    state.index = (Array.isArray(data) ? data : []).map(entry => ({
                        ...entry,
                        url: normalizeUrl(entry.url),
                        titleLower: (entry.title || '').toLowerCase()
                    }));
                })
                .catch(() => {
                    // 加载失败时重置状态
                    state.index = [];
                    state.indexLoadPromise = null;
                });
            return state.indexLoadPromise;
        },
        updateBodyClass() {
            // 切换 body 上的类，用于锁定背景滚动
            body.classList.toggle('modal--search--open', state.searchOpen);
        }
    };

    /**
     * 导航模块
     * @type {object}
     */
    const navModule = {
        open() {
            if (!navEnabled || state.navOpen) return;
            searchModule.close(); // 打开导航时关闭搜索
            state.navOpen = true;
            navOverlay.classList.add('showOverlay');
            navPanel.classList.add('is-open');
            if (navOpenBtn) navOpenBtn.setAttribute('aria-expanded', 'true');
            this.updateBodyClass();
            const firstLink = navPanel.querySelector('a');
            if (firstLink) requestAnimationFrame(() => firstLink.focus()); // 自动聚焦第一个链接
        },
        close() {
            if (!navEnabled || !state.navOpen) return;
            state.navOpen = false;
            navOverlay.classList.remove('showOverlay');
            navPanel.classList.remove('is-open');
            if (navOpenBtn) navOpenBtn.setAttribute('aria-expanded', 'false');
            this.updateBodyClass();
        },
        updateBodyClass() {
            // 切换 body 上的类，用于锁定背景滚动
            body.classList.toggle('modal--site-nav--open', state.navOpen);
        }
    };

    // --- E. 快捷键与事件监听 | SHORTCUTS & EVENT LISTENERS ---
    // ==========================================================================
    function initEventListeners() {
        let ctrlClickTimer = null;   // 用于检测单击/双击的计时器
        let ctrlClickCount = 0;      // Ctrl 键按下次數
        let lastCtrlKeydownMs = 0;   // 上次按下 Ctrl 的时间戳
        const multiClickDelay = 200; // 多次点击的延迟时间 (ms)

        // 全局键盘事件监听
        document.addEventListener('keydown', (e) => {
            // --- Ctrl 快捷键逻辑 ---
            if (e.key === 'Control' && !e.repeat) {
                e.preventDefault();
                const now = Date.now();
                // 如果弹窗已打开，快速按 Ctrl 关闭
                if (state.searchOpen || state.navOpen) {
                    if (now - lastCtrlKeydownMs < multiClickDelay + 50) {
                        state.navOpen ? navModule.close() : searchModule.close();
                    }
                    lastCtrlKeydownMs = now;
                    return;
                }
                
                ctrlClickCount++;
                if (ctrlClickTimer) clearTimeout(ctrlClickTimer);

                if (ctrlClickCount >= 3) { // 三击：切换主题
                    themeManager.toggle();
                    ctrlClickCount = 0;
                } else {
                    // 设置一个计时器，在延迟后根据点击次数执行操作
                    ctrlClickTimer = setTimeout(() => {
                        if (ctrlClickCount === 1) searchModule.open();      // 单击：打开搜索
                        else if (ctrlClickCount === 2) navModule.open(); // 双击：打开导航
                        ctrlClickCount = 0; // 重置计数
                    }, multiClickDelay);
                }
            }

            // --- Esc 键关闭弹窗 ---
            if (e.key === 'Escape') {
                if (state.navOpen) { e.preventDefault(); navModule.close(); }
                else if (state.searchOpen) { e.preventDefault(); searchModule.close(); }
            }
        });

        // --- 搜索输入框事件 ---
        input.addEventListener('input', () => searchModule.scheduleRender());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); searchModule.setMarked(state.activeIndex + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); searchModule.setMarked(state.activeIndex - 1); }
            else if (e.key === 'Enter') { e.preventDefault(); searchModule.navigate(); }
        });

        // --- 搜索结果列表事件 ---
        listEl.addEventListener('click', e => {
            if (e.target.closest('li[data-url]')) searchModule.navigate();
        });
        listEl.addEventListener('mouseover', e => {
            const li = e.target.closest('li[id^="search-opt-"]');
            if (li) searchModule.setMarked(parseInt(li.id.replace('search-opt-', ''), 10));
        });

        // --- 打开/关闭按钮和遮罩层事件 ---
        if (searchOpenBtn) searchOpenBtn.addEventListener('click', () => searchModule.open());
        searchOverlay.addEventListener('click', () => searchModule.close());
        
        if (navEnabled) {
            if (navOpenBtn) navOpenBtn.addEventListener('click', () => navModule.open());
            navOverlay.addEventListener('click', () => navModule.close());
        }
    }

    // --- F. 初始化 | INITIALIZATION ---
    // ==========================================================================
    function init() {
        themeManager.init();      // 初始化主题
        initEventListeners();     // 绑定所有事件
        // 延迟 500ms 后预加载搜索索引，避免影响初始页面加载性能
        setTimeout(() => searchModule.loadIndex(), 500); 
    }

    // 启动！
    init();

})();
