---
title: 常见问题
order: 9
---

## 如何改密码

编辑 `.env`：`CMS_PASS=新密码`，重启。

## CMS 语言怎么切换

CMS 跟随浏览器语言。切英文：Chrome 设置 → 语言 → 英语优先。

## 切换模板后前端没变

等 2-3 秒自动重启。生产环境 PM2 自动 rebuild。

## 文章不显示

检查 `draft` 是否为 true。草稿不显示。

## 首页案例区显示"即将上线"

编辑项目 → 勾选"精选"。首页只展示精选。

## 如何加自定义页面

CMS → 页面管理 → 新建。自动出现在导航栏。

## 如何升级

```bash
git pull && npm install && npm run build
```
