# frozen_string_literal: true
#
# bundle exec rake post TITLE="英文-slug" [DATE=YYYY-MM-DD] [SLUG=…] [CATEGORY=…]
# 未指定 DATE：用东八区「当下」日期与时间写入 front matter。
# 指定 DATE：文件名与日期用该日，时间仍为执行 rake 时东八区当下时刻（不再固定 12:00）。
# TITLE：用于生成文件名与 slug（你写英文短语即可，会规范成小写-连字符）。
# 也可只用 SLUG=…（二者至少填其一）。正文里的 title 留空，建好后自己写。
# 无拉丁字母时 slug 为 p-+MD5。CATEGORY 省略为「游戏」。
# front matter 的 date：东八区（+0800），精确到秒，与执行 rake 的瞬时一致；文件名仍只用 YYYY-MM-DD。

require 'date'
require 'digest'
require 'time'
require 'yaml'

DEFAULT_CATEGORY = '游戏'
URL_SLUG = /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/

def load_jekyll_config
  path = File.expand_path('_config.yml', __dir__)
  return {} unless File.file?(path)

  YAML.safe_load(File.read(path, encoding: 'UTF-8'), permitted_classes: [Date, Time], aliases: true) || {}
rescue Psych::SyntaxError, StandardError
  {}
end

# 与 _config.yml 中 date_format_post 一致；缺省与旧行为相同
def post_date_format
  @post_date_format ||= (load_jekyll_config['date_format_post'] || '%Y-%m-%d %H:%M:%S %z').to_s
end

# 固定东八区，避免本机系统时区不是中国时写错日期或排序异常
def time_now_cst
  Time.now.getlocal('+08:00')
end

def yaml_date_time_cst(t)
  t.strftime(post_date_format)
end

def env_utf8(key)
  raw = ENV[key] || ENV[key.downcase] or return ''
  s = raw.to_s
  return s if s.encoding == Encoding::UTF_8 && s.valid_encoding?
  s.encode('UTF-8', Encoding.find('locale'), invalid: :replace, undef: :replace)
rescue ArgumentError, Encoding::UndefinedConversionError
  s.encode('UTF-8', invalid: :replace, undef: :replace)
end

def slugify(s)
  s.to_s.downcase.gsub(/[^a-z0-9]+/, '-').gsub(/-+/, '-').gsub(/^-|-$/, '')
end

def resolve_url_slug(slug_source, date_str)
  manual = env_utf8('SLUG').strip
  unless manual.empty?
    u = slugify(manual)
    abort "SLUG 仅允许小写字母、数字、连字符，当前: #{manual.inspect}" if u.empty? || !URL_SLUG.match?(u)
    return u
  end
  from = slugify(slug_source)
  return from if from.length >= 2

  'p-' + Digest::MD5.hexdigest("#{date_str}\0#{slug_source}")[0, 10]
end

desc '新建文章: bundle exec rake post TITLE="英文slug" [DATE=…] [SLUG=…] [CATEGORY=…]（title 留空自填）'
task :post do
  slug_source = env_utf8('TITLE').strip
  abort '请指定 TITLE（作 slug）或 SLUG=…，例如: bundle exec rake post TITLE="my-post"' if slug_source.empty? && env_utf8('SLUG').strip.empty?

  now = time_now_cst
  raw_date = env_utf8('DATE').strip
  if raw_date.empty?
    date_for_file = now.strftime('%Y-%m-%d')
    date_for_yaml = yaml_date_time_cst(now)
  else
    begin
      d = Date.parse(raw_date)
      date_for_file = d.strftime('%Y-%m-%d')
      t = Time.new(d.year, d.month, d.day, now.hour, now.min, now.sec, '+08:00')
      date_for_yaml = t.strftime(post_date_format)
    rescue ArgumentError, TypeError
      abort "DATE 须为 YYYY-MM-DD，当前: #{raw_date.inspect}"
    end
  end
  slug = resolve_url_slug(slug_source, date_for_file)
  path = File.join('_posts', "#{date_for_file}-#{slug}.md")
  abort "文件已存在: #{path}" if File.exist?(path)

  cat = env_utf8('CATEGORY').strip
  cat = DEFAULT_CATEGORY if cat.empty?

  File.write(path, <<~MD, encoding: 'UTF-8')
    ---
    layout: post
    title: ""
    date: #{date_for_yaml}
    slug: #{slug}
    categories: #{cat}
    ---

  MD

  puts "已创建 #{path}"
  puts "URL 预览: /#{date_for_file}/#{slug}/"
end
