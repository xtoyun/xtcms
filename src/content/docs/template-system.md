---
title: 模板系统
order: 5
---

## 内置模板

| 模板 | 类型 | 说明 |
|------|------|------|
| blog | 基模板 | 文章、页面、SEO、友链、留言 |
| xtocn | 企业站 | + 项目、服务、产品、开源 |
| portfolio | 作品集 | + 作品展示、客户评价 |
| docs | 文档站 | + 文档（上下级树形） |

## 切换模板

**CMS 后台**：Templates → 启用 → 自动刷新

**手动**：编辑 `.xtcms/active-template.json` → 重启

## 创建模板

```bash
npm run create-template -- my-enterprise --extends blog
```

生成结构：

```
templates/my-enterprise/
├── template.yml        # 元信息 + extends
├── collections.yml     # 内容集合
└── src/pages/          # 覆盖/新增页面
```
