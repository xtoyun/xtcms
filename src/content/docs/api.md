---
title: API 接口
order: 7
---

## 外部 API（API Key 认证）

在 `.env` 中设置 `CMS_API_KEY`。

### 提交文章

```bash
curl -X POST http://localhost:4321/api/submit/article \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "标题", "content": "Markdown 正文", "tags": ["标签1"]}'
```

### 上传图片

```bash
curl -X POST http://localhost:4321/api/submit/upload \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@image.png"
```

### 联系表单

前端表单 POST 到 `/api/contact`，存入 `src/content/messages/`。

## CMS API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/cms/auth` | POST | 登录 |
| `/api/cms/files` | GET | 文件列表 |
| `/api/cms/commit` | POST | 保存内容 |
| `/api/cms/upload` | POST | 上传图片 |
| `/api/cms/templates` | GET/POST | 模板管理 |
| `/api/cms/theme` | GET/PUT | 主题设置 |
