---
layout: post
title: "用 JavaScript 提高前端搜索效率的几种写法"
date: 2026-04-04 20:00:00 +0800
slug: js-search-efficiency
categories: 笔记
---

前端「本地搜索」一般是：有一份文章列表（或 `search.json`），用户输入关键词，在内存里过滤出标题或正文匹配项。数据量不大时怎么写都行；条目变多以后，可以从下面几方面减负。

## 1. 预处理：别在每次按键里反复 `toLowerCase`

朴素写法每次过滤都对标题做一遍小写化，浪费 CPU：

```javascript
// 每次输入都执行：O(n) 次字符串分配
items = index.filter((entry) =>
  entry.title.toLowerCase().includes(query.toLowerCase())
);
```

构建索引时**一次性**存好小写标题（或存 `normalizedTitle`），查询时只对**用户输入**做一次规范化：

```javascript
function buildIndex(raw) {
  return raw.map((entry) => ({
    ...entry,
    _t: (entry.title || '').toLowerCase(),
  }));
}

function search(index, q) {
  const query = (q || '').trim().toLowerCase();
  if (!query) return index.slice(0, 20);
  return index.filter((e) => e._t.includes(query));
}
```

## 2. 控制触发频率：防抖、节流与 `requestAnimationFrame`

- **防抖（debounce）**：输入停顿例如 150ms 再搜，适合「输入很长、不想中间每一步都搜」。
- **`requestAnimationFrame`**：把「读 `input.value` + 渲染列表」对齐到下一帧，一帧内多次 `input` 事件只渲染一次，减少 DOM 抖动。本站搜索里用的就是这种思路。

```javascript
let raf = null;
function scheduleRender() {
  if (raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    raf = null;
    const q = input.value;
    render(q);
  });
}
input.addEventListener('input', scheduleRender);
```

防抖示例（可与 rAF 二选一或组合）：

```javascript
function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
const onSearch = debounce((q) => doSearch(q), 150);
```

## 3. 空闲时再拉索引：不抢首屏

若索引是单独 `fetch('search.json')`，不必在脚本**第一行**就请求；用 `requestIdleCallback`（带 `timeout`）或用户**即将打开搜索**时再加载，首屏会轻松一些。

```javascript
function prefetchSearchIndex(url, load) {
  const run = () => load(url);
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 1);
  }
}
```

## 4. 数据再变大时：倒排索引（思路）

只对「标题分词」级别可用：建 `词 -> 文章 id 列表` 的映射，查询词命中再取交集。实现成本比 `filter + includes` 高，条目上千再考虑。

```javascript
// 极简示意：按空格切词，仅作思路演示
function buildInverted(entries) {
  const map = new Map();
  entries.forEach((e, id) => {
    const words = (e.title || '').toLowerCase().split(/\s+/);
    words.forEach((w) => {
      if (!w) return;
      if (!map.has(w)) map.set(w, []);
      map.get(w).push(id);
    });
  });
  return map;
}
```

## 5. 小结

| 手段           | 适用场景           |
|----------------|--------------------|
| 预处理小写字段 | 任意本地标题搜索   |
| rAF / 防抖     | 输入频繁、列表重绘 |
| 空闲预取 JSON  | 独立索引文件       |
| 倒排 / 分词    | 大量文档、复杂查询 |

本站文章数量不多时，**预处理 + rAF** 通常就足够；索引变大再叠防抖或倒排即可。
