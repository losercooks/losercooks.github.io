---
layout: post
title: "Gemini CLI 连接故障排除指南 (2026年)"
date: 2026-04-13 17:06:06 +0800
slug: gemini-cli-connection-troubleshooting-guide-2026
categories: 笔记
---

当使用 Gemini CLI 时，如果出现 `ETIMEDOUT` 或 `fetch failed` 错误，这通常与网络代理配置或 Google Cloud 项目设置有关。以下是解决这些问题的详细步骤。

![Gemini CLI Error 示例](/assets/img/posts/gemini-cli-error.png)

## 1. 核心问题诊断

*   **现象**：报错 `ETIMEDOUT` 或 `fetch failed`。
*   **根本原因**：终端未正确读取系统代理，或 Google Cloud 项目未启用相关 API。

## 2. 解决步骤（按优先级排序）

### 第一步：设置终端代理环境变量

Gemini CLI 依赖 `HTTPS_PROXY` 环境变量。请根据你的操作系统执行相应命令：

#### macOS / Linux (Bash/Zsh)
```bash
export HTTPS_PROXY=http://127.0.0.1:你的代理端口
```

#### Windows (PowerShell)
```powershell
$env:HTTPS_PROXY="http://127.0.0.1:你的代理端口"
```

#### Windows (CMD)
```cmd
set HTTPS_PROXY=http://127.0.0.1:你的代理端口
```

> **注意**：将 `你的代理端口` 替换为实际值，例如 `7890` 或 `10808`。

---

### 第二步：配置 Google Cloud 项目 ID

如果提示 `GOOGLE_CLOUD_PROJECT` not found，请设置项目 ID：

1.  前往 [Google Cloud Console](https://console.cloud.google.com/)。
2.  创建或选择一个项目，复制 **项目 ID**（例如 `my-project-123456`）。
3.  在终端执行设置：
    ```bash
    export GOOGLE_CLOUD_PROJECT="你的项目ID"
    ```

---

### 第三步：启用 Gemini 相关 API

在 Google Cloud 控制台中：
1.  转到 **“API 和服务” > “库”**。
2.  搜索并启用 **“Generative Language API”**（或 Gemini for Google Cloud API）。
3.  启用后建议等待 1-2 分钟以使配置生效。

---

### 第四步：验证网络连通性

使用 `curl` 命令测试代理是否生效：
```bash
curl -v https://generativelanguage.googleapis.com/v1beta/models
```

*   **成功**：如果返回 JSON 列表，说明网络已通。
*   **失败**：如果依然超时，请检查代理软件是否开启了 **TUN 模式** 或 **允许局域网连接**。

## 3. 进阶调试与备选方案

| 诊断工具 | 说明 |
| :--- | :--- |
| **Debug 模式** | 运行 `gemini --verbose generate "hello"` 查看详细错误日志。 |
| **证书检查** | 若报 `x509` 错误，请检查代理软件的 CA 证书安装情况。 |
| **账号限制** | 确保不使用受限的 Google Workspace 企业账号（部分教育或企业版可能有权限限制）。 |
