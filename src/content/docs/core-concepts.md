---
title: 核心概念
order: 3
---

## 内容与表现分离

```
内容：src/content/      ← 你的文章、页面、设置（Markdown）
表现：templates/         ← 外观、布局、组件（Astro）
```

换模板 → 内容不变，外观变。写内容 → 模板不变，CMS 填。

## 模板继承

```
blog（基模板）           ← 文章 + 页面 + SEO + 友情链接 + 留言
  ├── xtocn             ← 继承 blog，加：项目案例 + 服务 + 产品
  ├── portfolio         ← 继承 blog，加：作品展示 + 客户评价
  └── docs              ← 继承 blog，加：文档（树形上下级）
```

子模板只维护自己新增/覆盖的文件，几十行代码衍生一个全新站点。

## 模板链

激活某个模板时，系统沿继承链合并所有文件：

```
激活 xtocn 时的文件查找顺序：
  1. 用户覆盖层 (.xtcms/overrides/)
  2. xtocn 模板 (templates/xtocn/)
  3. blog 基模板 (templates/blog/)
```

## 项目结构

```
xtcms-1.0/
├── src/
│   ├── core/              # 核心引擎
│   ├── pages/api/         # API 路由
│   └── content/           # 📝 你的内容（Markdown）
├── templates/             # ★ 模板系统
│   ├── blog/              #   内置基模板
│   ├── xtocn/             #   企业站
│   ├── portfolio/         #   作品集
│   └── docs/              #   文档站
├── .xtcms/                # 激活模板标记
└── public/admin/           # CMS 后台
```
