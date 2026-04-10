source "https://rubygems.org"

ruby "~> 3.3"

# 与 GitHub Pages「从分支构建」环境一致（依赖版本见 https://pages.github.com/versions.json）。
# 仓库 Settings → Pages：Source 选「Deploy from branch」，不要用 GitHub Actions，以免两套发布冲突。
# 克隆或改 Gemfile 后请在项目根目录执行：bundle install，并提交生成的 Gemfile.lock，便于与线上一致。
gem "github-pages", "~> 232", group: :jekyll_plugins

gem "rake", "~> 13.0"

# Windows：jekyll --watch / serve 时用原生目录监听，避免轮询（Jekyll 提示）
gem "wdm", ">= 0.1.0" if Gem.win_platform?
