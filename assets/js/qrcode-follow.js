;(function() {
  'use strict';

  // --- 1. 缓存 DOM 元素和配置 ---
  const img = document.getElementById('qrcode-cursor-follow');
  if (!img) return;
  
  const header = document.querySelector('.site-header');
  const footer = document.querySelector('.site-footer');
  if (!header || !footer) return;

  const OFFSET = 15; // 从光标的视觉偏移

  // --- 2. 状态管理 ---
  const state = {
    isLoaded: false,
    isVisible: false,
    currentTarget: null, // 跟踪鼠标是否在页眉或页脚上
    rafId: null,         // 用于保存 requestAnimationFrame 的 ID
    cursor: { x: 0, y: 0 }, // 存储最新的光标位置
  };

  // --- 3. 图片预加载 ---
  function preloadImage() {
    const src = img.getAttribute('data-src');
    if (!src) return;

    // 使用一个临时的 Image 对象进行加载
    const tempImg = new Image();
    tempImg.src = src;
    tempImg.onload = () => {
      img.src = src; // 仅在成功加载后设置实际的图片源
      state.isLoaded = true;
      if (state.isVisible) show(); // 如果鼠标已经在上面，则显示它
      tempImg.onerror = null;
    };
    tempImg.onerror = () => {
      const fallback = img.getAttribute('data-qrcode-fallback');
      if (fallback) {
        img.src = fallback;
        state.isLoaded = true;
        if (state.isVisible) show();
      }
    };
  }

  // --- 4. 核心动画逻辑 ---

  /**
   * 显示图片，如果动画循环未运行，则启动它。
   */
  function show() {
    if (!state.isLoaded) return; // 如果未加载则不显示
    img.hidden = false;
    state.isVisible = true;
    if (!state.rafId) {
      // 启动动画循环
      state.rafId = requestAnimationFrame(updatePosition);
    }
  }

  /**
   * 隐藏图片。动画循环将自行停止。
   */
  function hide() {
    img.hidden = true;
    state.isVisible = false;
  }

  /**
   * 在动画循环中运行的函数。
   * 它读取光标位置并更新图片的 transform。
   */
  function updatePosition() {
    // 如果图片不再可见，则停止循环。
    if (!state.isVisible) {
      state.rafId = null; // 清除 rafId 以表示循环已停止
      return;
    }
    
    const { x, y } = state.cursor;
    let transformStyle;

    if (state.currentTarget === header) {
      // 在页眉上：将二维码定位到光标的右下角
      transformStyle = `translate(${x + OFFSET}px, ${y + OFFSET}px)`;
    } else if (state.currentTarget === footer) {
      // 在页脚上：将二维码定位到光标的右上角
      const imgHeight = img.offsetHeight;
      transformStyle = `translate(${x + OFFSET}px, ${y - imgHeight - OFFSET}px)`;
    }
    
    img.style.transform = transformStyle;

    // 请求下一帧
    state.rafId = requestAnimationFrame(updatePosition);
  }


  // --- 5. 事件处理器 ---

  function handleMouseEnter(event) {
    state.currentTarget = event.currentTarget;
    show();
  }

  function handleMouseLeave() {
    state.currentTarget = null;
    hide();
  }
  
  /**
   * 监听整个页面的鼠标移动，
   * 但只更新我们状态中的坐标。
   */
  function trackMouseMove(event) {
    // 这比在 rAF 循环中读取 pageX/Y 更高效
    state.cursor.x = event.pageX;
    state.cursor.y = event.pageY;
  }

  // --- 6. 初始化 ---
  
  // 将 mouseenter/mouseleave 附加到页眉和页脚
  [header, footer].forEach(element => {
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
  });
  
  // 在 body 上的单个 mousemove 监听器是高效的
  document.body.addEventListener('mousemove', trackMouseMove, { passive: true });

  // 开始预加载图片
  preloadImage();

})();
