/**
 *
 * 这是一个功能丰富的轮播组件 (Slider/Carousel) 的 JavaScript 实现。
 *
 * 主要功能：
 * 1.  支持响应式布局，自动计算项目宽度。
 * 2.  支持键盘导航（左右箭头）。
 * 3.  点击图片可打开一个灯箱 (Lightbox) 查看大图。
 * 4.  灯箱内支持键盘导航（左右箭头、ESC 关闭）。
 * 5.  支持图片说明 (Caption)，在灯箱中显示，并与图片宽度保持一致。
 * 6.  性能优化：
 *     - 使用 translate3d 开启硬件加速。
 *     - 使用 requestAnimationFrame 进行流畅的动画和布局计算。
 *     - 使用 ResizeObserver 高效监听尺寸变化。
 *     - 事件委托以减少事件监听器数量。
 *     - 尊重用户的 `prefers-reduced-motion` 系统偏好。
 * 7.  从 CSS 自定义属性 (`--slider-gap`) 读取配置，并提供后备值。
 * 8.  代码结构清晰，通过类 (Class) 进行封装。
 *
 * 使用方法：
 * 在 HTML 中，使用 `data-slider` 属性来初始化一个轮播。
 * `data-slider-visible` 属性可以指定每页可见的项目数量。
 * 图片的说明文字通过 `data-slider-caption` 属性添加到 `<img>` 标签上。
 *
 */
(function () {
    'use strict';

    // A. 定数 | Constants
    // ==========================================================================

    // 从 CSS var(--slider-gap) 读取失败时的后备值
    const SLIDER_GAP_FALLBACK_PX = 8;
    // 全局灯箱键盘事件处理器（WeakMap 用于自动内存管理）
    const lightboxKeyHandlers = new WeakMap();

    // 全局键盘事件监听，用于处理打开的灯箱
    document.addEventListener('keydown', (e) => {
        const lb = document.querySelector('[data-slider-lightbox]:not([hidden])');
        if (lb) {
            const root = lb.closest('[data-slider]');
            const handler = root && lightboxKeyHandlers.get(root);
            if (handler) handler(e);
        }
    }, true); // 使用捕获阶段以优先处理

    // B. Slider 类 | Slider Class
    // ==========================================================================

    class Slider {
        constructor(root) {
            this.root = root; // 轮播组件根元素
            this.visible = this.parseVisible(); // 每页可见幻灯片数
            this.reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; // 检测是否开启减弱动态效果

            // 缓存 DOM 元素引用
            this.elements = {
                viewport: root.querySelector('.slider__viewport'),
                track: root.querySelector('[data-slider-track]'),
                prevBtn: root.querySelector('[data-slider-prev]'),
                nextBtn: root.querySelector('[data-slider-next]'),
                // 灯箱相关元素
                lightbox: root.querySelector('[data-slider-lightbox]'),
                lightboxImg: root.querySelector('[data-slider-lightbox-img]'),
                lightboxCaption: root.querySelector('[data-slider-lightbox-caption]'),
                lightboxClose: root.querySelector('[data-slider-lightbox-close]'),
                lightboxBackdrop: root.querySelector('[data-slider-lightbox-backdrop]'),
                lightboxPrev: root.querySelector('[data-slider-lightbox-prev]'),
                lightboxNext: root.querySelector('[data-slider-lightbox-next]'),
            };

            // 确保核心元素存在
            if (!this.elements.viewport || !this.elements.track || !this.elements.prevBtn || !this.elements.nextBtn) return;
            
            this.items = Array.from(this.elements.track.children); // 所有幻灯片元素
            this.total = this.items.length; // 幻灯片总数
            if (this.total === 0) return;

            // 维护轮播状态
            this.state = {
                pageIndex: 0, // 当前页码 (0-based)
                lightboxOpen: false, // 灯箱是否打开
                lightboxIndex: 0, // 灯箱中当前图片的索引
                resizeRaf: null, // 用于 resize 事件的 requestAnimationFrame ID
                layoutZeroRetries: 0, // 布局计算宽度为 0 时的重试次数
            };

            this.init();
        }

        // 初始化
        init() {
            this.bindEvents(); // 绑定事件监听
            this.setupResizeObserver(); // 设置尺寸变化监听
            this.layout(); // 计算并应用布局
            this.sync(); // 同步状态到 UI
            this.root.setAttribute('tabindex', '0'); // 使根元素可聚焦以接收键盘事件
        }

        // 解析每页可见数量
        parseVisible() {
            const n = parseInt(this.root.getAttribute('data-slider-visible') || '4', 10);
            return !n || n < 1 ? 4 : n; // 默认为 4
        }

        // C. 布局与同步 | Layout & Sync
        // ==========================================================================

        // 计算并应用幻灯片和轨道的宽度
        layout() {
            const slideWidth = this.getSlideWidth();
            // 如果初始加载时视口宽度为 0 (例如 display:none)，则稍后重试
            if (!slideWidth) {
                if (this.state.layoutZeroRetries < 40) { // 最多重试 40 次 (~0.6s)
                    this.state.layoutZeroRetries++;
                    requestAnimationFrame(() => this.scheduleResize());
                }
                return;
            }
            this.state.layoutZeroRetries = 0; // 成功获取宽度后重置计数器

            const gap = this.getGap();
            // 设置每张幻灯片的宽度 (flex-basis)
            this.items.forEach(item => {
                item.style.flex = `0 0 ${slideWidth}px`;
                item.style.width = `${slideWidth}px`;
            });
            // 设置轨道的总宽度
            this.elements.track.style.width = `${slideWidth * this.total + (this.total - 1) * gap}px`;
        }

        // 根据当前状态更新 UI (位移、按钮禁用状态)
        sync() {
            const maxPage = Math.max(0, this.total - this.visible);
            this.state.pageIndex = Math.max(0, Math.min(this.state.pageIndex, maxPage));
            
            const slideWidth = this.getSlideWidth();
            if (slideWidth > 0) {
                const step = slideWidth + this.getGap(); // 每页滚动的距离
                // 使用 translate3d 开启硬件加速
                this.elements.track.style.transform = `translate3d(${-this.state.pageIndex * step}px, 0, 0)`;
                // 减弱动态效果时禁用过渡动画
                this.elements.track.style.transition = this.reduceMotion ? 'none' : 'transform 0.35s ease';
            }

            const atEnd = maxPage === 0; // 如果所有项都可见，则禁用按钮
            this.elements.prevBtn.disabled = this.state.pageIndex === 0 || atEnd;
            this.elements.nextBtn.disabled = this.state.pageIndex === maxPage || atEnd;
        }

        // D. 辅助方法 | Helpers
        // ==========================================================================

        // 调度一次 resize 计算（防抖）
        scheduleResize() {
            if (this.state.resizeRaf) cancelAnimationFrame(this.state.resizeRaf);
            this.state.resizeRaf = requestAnimationFrame(() => {
                this.layout();
                this.sync();
            });
        }

        // 计算单张幻灯片的宽度
        getSlideWidth() {
            const st = getComputedStyle(this.elements.viewport);
            const padding = (parseFloat(st.paddingLeft) || 0) + (parseFloat(st.paddingRight) || 0);
            const innerWidth = this.elements.viewport.clientWidth - padding;
            // (视口内宽 - (可见数-1) * 间距) / 可见数
            return innerWidth > 0 ? (innerWidth - (this.visible - 1) * this.getGap()) / this.visible : 0;
        }
        
        // 从 CSS 自定义属性 '--slider-gap' 获取间距值
        getGap() {
            const value = getComputedStyle(this.root).getPropertyValue('--slider-gap').trim();
            const n = parseFloat(value);
            return isNaN(n) ? SLIDER_GAP_FALLBACK_PX : n;
        }
        
        // E. 事件处理 | Event Handlers
        // ==========================================================================

        // 绑定所有事件监听器
        bindEvents() {
            this.elements.prevBtn.addEventListener('click', () => this.setPage(this.state.pageIndex - 1));
            this.elements.nextBtn.addEventListener('click', () => this.setPage(this.state.pageIndex + 1));

            // 点击轨道中的图片打开灯箱
            this.elements.track.addEventListener('click', this.onTrackClick.bind(this));
            // 根元素上的键盘事件，用于左右箭头翻页
            this.root.addEventListener('keydown', this.onRootKeydown.bind(this));
            
            // 如果存在灯箱元素，则绑定灯箱相关事件
            if (this.elements.lightbox) {
                // 将灯箱键盘处理器存入 WeakMap
                lightboxKeyHandlers.set(this.root, this.onLightboxKeydown.bind(this));
                // 点击关闭按钮
                this.elements.lightboxClose?.addEventListener('click', (e) => { e.stopPropagation(); this.closeLightbox(); });
                // 点击背景遮罩
                this.elements.lightboxBackdrop?.addEventListener('click', () => this.closeLightbox());
                // 灯箱内的上一张/下一张
                this.elements.lightboxPrev?.addEventListener('click', (e) => { e.stopPropagation(); this.lightboxStep(-1); });
                this.elements.lightboxNext?.addEventListener('click', (e) => { e.stopPropagation(); this.lightboxStep(1); });
                // 点击灯箱容器本身（非内容区域）
                this.elements.lightbox.addEventListener('click', (e) => { if (e.target === this.elements.lightbox) this.closeLightbox(); });
            }
        }
        
        // 设置当前页码并同步 UI
        setPage(index) {
            this.state.pageIndex = index;
            this.sync();
        }

        // --- 灯箱方法 | Lightbox Methods ---

        // 打开灯箱
        openLightbox(index) {
            if (!this.elements.lightbox || this.total < 1) return;
            // 确保索引在有效范围内循环
            this.state.lightboxIndex = ((index % this.total) + this.total) % this.total;
            this.updateLightboxImage(); // 更新图片和说明
            this.state.lightboxOpen = true;
            this.elements.lightbox.removeAttribute('hidden');
            // 给 body 添加类名以隐藏主滚动条
            document.body.classList.add('slider-lightbox-open');
            // 聚焦关闭按钮，便于键盘操作
            this.elements.lightboxClose?.focus();
        }

        // 关闭灯箱
        closeLightbox() {
            if (!this.state.lightboxOpen) return;
            this.state.lightboxOpen = false;
            this.clearLightboxCaptionWidth(); // 清除说明宽度
            this.elements.lightbox.setAttribute('hidden', '');
            document.body.classList.remove('slider-lightbox-open');
        }

        // 更新灯箱中的图片和说明文字
        updateLightboxImage() {
            const { lightboxImg, lightboxCaption } = this.elements;
            if (!lightboxImg) return;
            const item = this.getItemData(this.state.lightboxIndex);
            
            lightboxImg.src = item.src;
            lightboxImg.alt = item.caption || '';

            if (lightboxCaption) {
                lightboxCaption.textContent = item.caption;
                lightboxCaption.hidden = !item.caption;
                if (item.caption) {
                    // 图片加载后，同步说明文字的宽度
                    lightboxImg.addEventListener('load', () => this.queueCaptionWidthSync(), { once: true });
                    this.queueCaptionWidthSync(); // 立即尝试同步一次
                } else {
                    this.clearLightboxCaptionWidth();
                }
            }
        }

        // 灯箱内切换图片
        lightboxStep(delta) {
            // (current + delta + total) % total 确保索引在 [0, total-1] 范围内循环
            this.state.lightboxIndex = (this.state.lightboxIndex + delta + this.total) % this.total;
            this.updateLightboxImage();
        }

        // 从幻灯片元素中提取图片 src 和说明
        getItemData(index) {
            const img = this.items[index]?.querySelector('img');
            return {
                src: img?.src || '',
                caption: img?.dataset.sliderCaption || '' // 从 data-slider-caption 属性获取
            };
        }

        // --- 灯箱说明文字尺寸同步 | Lightbox Caption Sizing ---

        // 清除说明文字的内联宽度
        clearLightboxCaptionWidth() {
            if (this.elements.lightboxCaption) this.elements.lightboxCaption.style.width = '';
        }
        
        // 同步说明文字的宽度，使其与图片宽度一致
        syncLightboxCaptionWidth() {
            if (!this.state.lightboxOpen || !this.elements.lightboxImg || !this.elements.lightboxCaption) return;
            if (!this.getItemData(this.state.lightboxIndex).caption) return;
            const width = this.elements.lightboxImg.getBoundingClientRect().width;
            if (width > 0) this.elements.lightboxCaption.style.width = `${width}px`;
        }
        
        // 在下一帧调度说明宽度同步
        queueCaptionWidthSync() {
            if (!this.state.lightboxOpen || !this.getItemData(this.state.lightboxIndex).caption) return;
            // 使用 rAF 确保在浏览器完成布局计算后执行
            requestAnimationFrame(() => this.syncLightboxCaptionWidth());
        }
        
        // --- 具体事件处理器 | Specific Event Handlers ---

        // 点击轨道事件委托
        onTrackClick(e) {
            const img = e.target.closest('img');
            if (!img) return;
            const item = img.closest('.slider__item');
            // 确保点击的是轨道内的幻灯片
            if (!item || !this.elements.track.contains(item)) return;
            
            e.preventDefault();
            const index = this.items.indexOf(item);
            if (index !== -1) this.openLightbox(index);
        }

        // 灯箱打开时的全局键盘事件
        onLightboxKeydown(e) {
            if (!this.state.lightboxOpen) return;
            const keyMap = {
                'Escape': () => this.closeLightbox(),
                'ArrowLeft': () => this.lightboxStep(-1),
                'ArrowRight': () => this.lightboxStep(1),
            };
            if (keyMap[e.key]) {
                e.preventDefault();
                keyMap[e.key]();
            }
        }

        // 轮播组件根元素上的键盘事件（非灯箱状态）
        onRootKeydown(e) {
            if (this.state.lightboxOpen) return; // 灯箱打开时，由 onLightboxKeydown 处理
            const keyMap = {
                'ArrowLeft': () => this.setPage(this.state.pageIndex - 1),
                'ArrowRight': () => this.setPage(this.state.pageIndex + 1),
            };
            if (keyMap[e.key]) {
                e.preventDefault();
                keyMap[e.key]();
            }
        }

        // --- 响应式处理 | Responsive Handling ---

        // 设置尺寸变化监听
        setupResizeObserver() {
            // 优先使用 ResizeObserver 提高性能
            if (typeof ResizeObserver !== 'undefined') {
                const ro = new ResizeObserver(() => this.scheduleResize());
                ro.observe(this.elements.viewport);

                // 同时监听灯箱图片尺寸变化，以同步说明宽度
                if (this.elements.lightboxImg) {
                    new ResizeObserver(() => this.syncLightboxCaptionWidth()).observe(this.elements.lightboxImg);
                }
            } else {
                // 后备方案：监听 window resize 事件
                window.addEventListener('resize', () => {
                    this.scheduleResize();
                    this.queueCaptionWidthSync();
                }, { passive: true });
            }
        }
    }

    // C. 初始化 | Initialization
    // ==========================================================================
    // 实例化所有轮播组件
    document.querySelectorAll('[data-slider]').forEach(slider => new Slider(slider));

})();
