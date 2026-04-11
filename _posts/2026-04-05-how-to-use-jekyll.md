---
layout: post
title: "Jekyll 怎么用：安装、目录与本地预览"
date: 2026-04-05 12:51:26 +0800
slug: how-to-use-jekyll
categories: 笔记
---

[Jekyll](https://jekyllrb.com/) 是静态站点生成器：你写 **Markdown / HTML / Liquid 模板**，它生成一堆可直接放到服务器或 **GitHub Pages** 上的静态文件。本站就是 Jekyll 项目，下面按「在本仓库里实际怎么操作」来说明。

## 1. 环境准备

- 已安装 **Ruby 3.3.x**（本仓库 `Gemfile` 约束为 `~> 3.3`，用来对齐 GitHub Pages 的 Ruby 版本线）。
- 安装 **Bundler**（Ruby 的依赖管理）：`gem install bundler`。

在项目根目录（有 `Gemfile` 的地方）执行一次：

```bash
bundle install
```

会根据 `Gemfile.lock` 安装依赖。本仓库为了**直接用 GitHub Pages「从分支构建」**（不走 Actions），依赖采用 `github-pages` 元 gem 来锁定版本线（其中 **Jekyll 为 3.10.x**，与 Pages 环境一致）。Windows 下还会装 **wdm**，方便 `serve` 时监听文件变化。

## 2. 本地预览（最常用）

```bash
bundle exec jekyll serve
```

默认在 **http://127.0.0.1:4000** 打开站点；改文件后多数情况会自动重新生成，刷新浏览器即可。

只生成、不启服务：

```bash
bundle exec jekyll build
```

产物在 **`_site/`** 目录（一般加入 `.gitignore`，不必提交）。

> 提示：务必加 **`bundle exec`**，避免系统里另一个版本的 `jekyll` 和当前 `Gemfile.lock` 不一致。

Windows PowerShell 里建议不要把命令写成 `cd ... && ...` 的链式写法；更稳的是：

```powershell
Set-Location D:\path\to\losercooks.github.io
bundle exec jekyll serve
```

把路径换成你本机克隆下来的项目根目录。

## 3. 本仓库里你该认识的目录

| 路径 | 作用 |
|------|------|
| `_config.yml` | 站点配置：`url`、`baseurl`、Markdown 引擎、文章 `permalink` 等 |
| `_posts/` | 文章，文件名 `YYYY-MM-DD-英文slug.md`，正文前有 **YAML front matter** |
| `_layouts/` | 页面骨架，如 `default.html`、`post.html` |
| `_includes/` | 可复用片段：导航、搜索、菜单列表等 |
| `_sass/` | 样式分片，由 `assets/css/main.scss` 汇总 |
| `assets/` | 静态资源：`css`、`js`、图片等 |
| `_data/` | YAML/JSON 数据，如 `menu.yml`、`site_nav.yml` |

文章 URL 由 `_config.yml` 的 `defaults` 决定，本站为 **`/:year-:month-:day/:slug/`**（与每篇里的 `slug` 字段一致）。

## 4. 新建一篇文章

推荐用仓库里的 **Rake** 任务（会自动写 `date`、`slug`、模板）：

```bash
bundle exec rake post TITLE="英文-slug" CATEGORY=笔记
```

也可复制 `_posts` 里现有文章，改 **文件名日期**、**front matter**（`title`、`date`、`slug`、`categories`）和正文。

时间、slug 规则见根目录 **`Rakefile`** 顶部注释。

## 5. `url` 与 `baseurl`（上线必查）

在 `_config.yml` 里：

- **`url`**：站点完整根地址，例如 `https://losercooks.github.io`。
- **`baseurl`**：若站点挂在 **`https://username.github.io/仓库名/`** 这种**子路径**，这里写 `/仓库名`；用户站根域名部署则为空字符串 `""`。

模板里资源、内链常用 Liquid 过滤器 **`relative_url`**，避免路径在本地与线上不一致。

## 6. 和本站其它文章的关系

- 部署到 GitHub Pages（结合本项目版本线与踩坑记录），见《[把本项目部署到 GitHub Pages：Jekyll 版本、Ruby、配置与踩坑记录]({{ '/2026-04-04/jekyll-github-pages/' | relative_url }})》。
- Markdown 写法与示例，见《[Markdown 语法速查与实操案例]({{ '/2026-04-05/markdown-syntax/' | relative_url }})》。
- 版本管理日常命令，见《[Git 使用入门：从工作区到远程仓库]({{ '/2026-04-05/git-usage/' | relative_url }})》。

## 7. 常见问题

| 现象 | 可检查 |
|------|--------|
| 改 `_config.yml` 不生效 | 重启 `jekyll serve`（配置不参与增量时） |
| 样式没更新 | 确认保存的是 `_sass` / `assets/css/main.scss`，看终端是否报错 |
| Windows 下中文乱码 | 仓库已设 `encoding: utf-8`，编辑器与终端也尽量用 UTF-8 |
| `bundle install` 访问 rubygems 超时 | 换网络/代理；或临时使用镜像把依赖装完并生成 `Gemfile.lock`（最终以 lock 为准） |

## 8. 总结

**`bundle install` 一次 → 日常 `bundle exec jekyll serve` 写文预览 → 满意后推送到 GitHub Pages（本仓库用“从分支构建”）。** 先把本地跑通，再折腾域名即可。
