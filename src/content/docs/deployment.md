---
title: 部署运维
order: 8
---

## 生产构建

```bash
npm run build
npm start
```

## PM2（推荐）

```bash
npm install -g pm2
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

模板切换时 PM2 自动重启。

## 宝塔面板

1. 软件商店 → Node.js 版本管理器 → 安装 Node 22
2. 上传 `dist/` `public/` `templates/` `src/content/` `.env`
3. Node 项目 → 启动文件：`dist/server/entry.mjs`
4. 放行端口 + 反向代理

## Nginx 反代

```nginx
server {
    listen 80;
    server_name your-domain.com;
    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_set_header Host $host;
    }
}
```

## 备份

```bash
git add src/content/ && git commit -m "backup" && git push
```
