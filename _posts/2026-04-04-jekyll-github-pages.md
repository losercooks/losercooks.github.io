---
layout: post
title: "把本项目部署到 GitHub Pages：Jekyll 版本、Ruby、配置与踩坑记录"
date: 2026-04-04 14:30:00 +0800
slug: jekyll-github-pages
categories: 笔记
---

这篇不是泛泛的“怎么部署”，而是把这个仓库（`losercooks.github.io`）从本地推到 GitHub Pages 的过程写清楚，重点放在**版本一致性**与**容易踩的坑**：GitHub Pages 默认 Jekyll 版本、`github-pages` gem、Ruby 升级、网络导致的 Bundler 超时、以及 `_config.yml` 的 `url` / `baseurl` / `permalink` 怎么配才不会 404。

![从推送到站点上线：代码进仓库，再由 Pages 发布]({{ '/assets/img/posts/jekyll-gh-pages-flow.png' | relative_url }})

## 1. 先分清：用户站还是项目站（决定 baseurl）

GitHub Pages 常见两种站点形态：

- **用户站 / 组织站**：仓库名必须是 **`<user>.github.io`**（或 `<org>.github.io`），访问路径是域名根：`https://<user>.github.io/`。
- **项目站**：仓库名任意，访问路径通常是：`https://<user>.github.io/<repo>/`。

这个仓库属于**用户站**：域名就是 `losercooks.github.io`，所以 **`baseurl` 必须为空字符串**。

对应配置（本项目最终采用）：

```yaml
url: "https://losercooks.github.io"
baseurl: ""
```

如果你做的是项目站，则通常是：

```yaml
url: "https://<user>.github.io"
baseurl: "/<repo>"
```

![示意：在仓库 Settings → Pages 中选择发布源（如 Actions 构建）]({{ '/assets/img/posts/jekyll-gh-pages-settings.png' | relative_url }})

## 2. “不用 Actions，直接 Pages 构建”时：先接受一个事实

GitHub Pages 的“从分支构建”（Deploy from a branch）不是用你本机的 Jekyll 版本，它用的是官方锁定的一套依赖。

可以在这里看到当前 Pages 环境版本：

- [pages.github.com/versions.json](https://pages.github.com/versions.json)

我查到的版本里，**Jekyll 是 3.10.0**，Ruby 是 3.3.x。也因此：

- 如果你本地用的是 **Jekyll 4.x**，但线上走“分支构建”，就可能出现“本地能 build，线上失败”的差异。
- 想把差异降到最小，最稳的方式是：本地也使用 **`github-pages`** 元 gem（它会锁定到与 Pages 环境一致的 Jekyll/插件版本）。

## 3. 本项目的选择：用 `github-pages` 锁版本（对齐 Pages）

本仓库最终的 `Gemfile` 核心就是：

```ruby
source "https://rubygems.org"
ruby "~> 3.3"
gem "github-pages", "~> 232", group: :jekyll_plugins
```

这样你本地 `bundle exec jekyll build` 用的就是 Pages 这条“版本线”。`Gemfile.lock` 提交进仓库后，协作者 `bundle install` 也会得到同一套解析结果。

## 4. 本项目踩过的坑与解决方法

### 4.1 Ruby 版本不匹配：2.7 跑不动 `github-pages`

我一开始机器上是 Ruby 2.7（`C:\Ruby27-x64`），然后在 `Gemfile` 写了 `ruby "~> 3.3"` 后，`bundle exec jekyll build` 直接报：

- “Your Ruby version is 2.7.x, but your Gemfile specified ~> 3.3”

解决：把 Ruby 升到 3.3（我本机最后装的是 RubyInstaller 的 **3.3.11-1**，同属 3.3 系列，兼容没问题），并确保终端里 `where ruby` 指向新路径。

### 4.2 rubygems.org 网络超时：Bundler 安装依赖卡住

在部分网络环境下会出现：

- `Failed to open TCP connection to rubygems.org:443 (execution expired)`

解决：临时切镜像源跑通 `bundle install`，生成 `Gemfile.lock` 后再切回官方源都可以（最终以 `Gemfile.lock` 为准）。如果你坚持不用镜像，那就需要更稳定的网络（或代理）。

### 4.3 PowerShell 里别写 `cd ... && ...`

在 Windows PowerShell 下，`&&` 可能导致解析错误。更稳的写法是：

```powershell
Set-Location D:\path\to\losercooks.github.io
bundle exec jekyll build
```

把路径换成你本机克隆下来的**项目根目录**（含 `Gemfile` 的那一层）。

### 4.4 `url` / `baseurl` 没配对：上线后资源/链接 404

这类问题最典型：本地打开没事，上线后路径带了仓库子路径或缺了站点根，导致 CSS/图片 404。建议的通用写法是：

- 资源路径统一写 `{{ '/assets/...' | relative_url }}`
- 站内链接统一写 `{{ '/xxx/' | relative_url }}`

这样 `baseurl` 变化时不用全站改链接。

## 5. 本项目的最终“最小可复现部署步骤”

1. 确认仓库是 **`losercooks.github.io`**（用户站）并推送到默认分支。
2. 本地 Ruby 3.3 + Bundler，执行：

   ```powershell
   bundle install
   bundle exec jekyll build
   ```

3. GitHub 仓库 Settings → Pages：

   - Source 选 **Deploy from a branch**
   - Branch 选默认分支 + `/(root)`

## 6. 小结

部署的关键不是“按教程抄一遍”，而是让**本地构建环境**与 **GitHub Pages 构建环境**尽量一致。这个仓库选择了 `github-pages` 来对齐 Pages 的 Jekyll 3.10 版本线，并把 `url` / `baseurl` 固定到用户站形态，从而减少“本地 OK，线上炸”的概率。
