---
layout: post
title: "BEM 命名法：让类名可读、可维护的块—元素—修饰符"
date: 2026-04-11 14:52:29 +0800
slug: bem-naming-convention
categories: 笔记
---

**BEM**（Block、Element、Modifier）是一种给 **CSS 类名**定规矩的写法：名字里直接带出「这是哪一块 UI」「属于块里的哪一部分」「有没有变体」。团队越大、页面越复杂，越能体会「类名即文档」的价值。

## 三个字母分别是什么

**Block（块）** 是独立、可复用的界面单元，例如一张卡片、一个导航条、一个搜索框。块的名字单独成类，例如 `card`、`site-nav`。

**Element（元素）** 是块内部的组成部分，不能脱离语义上的父块单独存在（在命名上用双下划线挂在块后面），例如 `card__title`、`card__body`。

**Modifier（修饰符）** 表示块或元素的**状态或变体**（外观、尺寸、是否选中等），用双连字符接在块或元素后面，例如 `card--highlight`、`button--disabled`。

约定俗成的拼接形式可以记成：**`块__元素--修饰符`**；修饰符只挂在「被修饰」的那一层上，不要一串修饰符乱叠在同一名称里。

## 最小可运行例子：卡片

HTML 把结构说清楚，类名一一对应：

```html
<article class="card card--featured">
  <h2 class="card__title">文章标题</h2>
  <p class="card__excerpt">摘要文字……</p>
  <a class="card__link" href="/post/1">阅读全文</a>
</article>
```

CSS 只依赖这些类，避免「`.card h2`」这种深层选择器，以后改标签名也不容易误伤：

```css
.card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
}

.card--featured {
  border-color: #c60;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.card__title {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}

.card__excerpt {
  margin: 0 0 1rem;
  color: #555;
}

.card__link {
  font-weight: 600;
}
```

这里 `card` 是块，`card__title` 等是元素，`card--featured` 是块的修饰符（精选样式）。

## 按钮：修饰符挂在块上

同一套按钮结构，用修饰符区分主次，而不是写 `btn-red`、`btn2` 这种猜不透含义的名字：

```html
<button class="button" type="button">默认</button>
<button class="button button--primary" type="button">主要操作</button>
<button class="button button--ghost" type="button">次要</button>
<button class="button button--primary" type="button" disabled>不可用</button>
```

```css
.button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 1px solid #ccc;
  background: #fff;
}

.button--primary {
  border-color: #06c;
  background: #06c;
  color: #fff;
}

.button--ghost {
  border-color: transparent;
  background: transparent;
}

.button[disabled],
.button.button--disabled {
  opacity: 0.5;
  pointer-events: none;
}
```

若「不可用」既可能是原生 `disabled`，也可能是业务上的禁用态，可以像上面一样用属性选择器或额外的 `button--disabled` 类与视觉样式对齐。

## 元素上的修饰符

有时变体只针对某一个元素，修饰符就挂在元素名后面：

```html
<ul class="tabs">
  <li class="tabs__item tabs__item--active">
    <a class="tabs__link" href="#a">A</a>
  </li>
  <li class="tabs__item">
    <a class="tabs__link" href="#b">B</a>
  </li>
</ul>
```

```css
.tabs__item {
  display: inline-block;
}

.tabs__item--active .tabs__link {
  font-weight: 700;
  border-bottom: 2px solid currentColor;
}
```

## 实际书写时注意的几点

双下划线 `__` 和双连字符 `--` 把「块 / 元素 / 修饰符」三段分开，解析时一眼能拆；单词之间习惯用单个连字符 `kebab-case`，避免和修饰符的双连字符混淆（所以块名里不要用裸的双连字符）。

不要为了「纯 BEM」强行给每个 DOM 节点都造 `块__元素`：没有复用价值、只是布局用的包裹层，可以用单一目的的类名，或交给外层块的子选择器在**极窄范围**内使用（团队规范要提前说好）。

JavaScript 挂钩子时，如果担心改类名会破坏脚本，可以单独使用 `data-*` 或约定好的 `js-*` 前缀类，与 BEM 样式类分离，减少耦合。

BEM 解决的是**命名空间与可读性**：新人打开模板能猜出类的作用，改样式时知道该搜哪个类。它不替代设计系统、不替代组件框架，但作为 CSS 类名的纪律，仍然非常值得在中小型项目里坚持。
