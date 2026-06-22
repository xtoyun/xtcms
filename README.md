# XTCMS 1.0

> **开源 Astro CMS 框架 · 模板继承 · 内容与表现彻底分离**

一套开源的轻量级建站框架。不做数据库、不做插件生态——模板即代码，内容即文件，社区共建模板生态。

**演示站**：[www.xtocn.com](https://www.xtocn.com)

---

## 核心理念

```
内容          src/content/*.md    ← 你的数据，永远属于你
  ↕ 彻底分离
表现          模板包              ← 社区贡献，随时切换
```

换模板不丢内容，写内容不改代码。博客模板、企业模板、财税模板——一套内容，多种面貌。

### 模板继承

```
blog (基模板)                     ← 文章 + 页面 + 关键字 + 友情链接 + 留言
  ├── xtocn (企业站)              ← +项目案例 +服务 +产品 +开源项目
  ├── finance (财税站)            ← +法规库 +计算工具（社区贡献）
  └── portfolio (作品集)          ← +作品集 +客户评价（社区贡献）
```

子模板只写差异部分，几十行代码就能基于 blog 衍生一个全新站点。

---

## 上手三步

### 1. 安装

```bash
git clone https://github.com/xtocn/xtcms.git && cd xtcms-1.0 && npm install
```

### 2. 本地跑起来

```bash
npm run dev
```

浏览器打开 `http://localhost:4321`。打开 `http://localhost:4321/admin`，默认 `admin` / `admin`。

### 3. 选个模板

后台 → Templates → 选择 xtocn（企业站）或 blog（博客）。前端自动切换。

---

## 模板系统

### 模板是什么

一个模板 = 一个独立目录，包含：

```
templates/xtocn/
├── template.yml        # 元信息 + extends 声明 + 可配置项
├── collections.yml     # 内容类型（CMS 后台自动生成）
├── src/
│   ├── layouts/        # 页面外壳（覆盖基模板）
│   ├── pages/          # 路由页面（覆盖/新增）
│   └── components/     # 模板专有组件
└── assets/             # 截图 + 缩略图
```

### 模板可配置项

模板声明 `customizable`，CMS 后台自动生成主题设置面板：

```yaml
customizable:
  colors:
    - { name: primary, label: 主色调, type: color, default: "#000000" }
  typography:
    - { name: heading_font, label: 标题字体, type: select, options: [...], default: "PingFang SC" }
  layout:
    - { name: container_width, label: 内容区宽度, type: select, options: ["680px", "800px", "960px"], default: "800px" }
```

不改代码也能调颜色、字体、布局。配置存为数据，换模板不丢失。

### 开发模板

```bash
# 从零创建
npx create-xtcms-template my-enterprise

# 基于 blog 衍生（推荐）
npx create-xtcms-template my-enterprise --extends blog
```

发布到 npm：`xtcms-template-*`，社区即可发现和安装。

---

## 内容管理（/admin）

Sveltia CMS 驱动，可视化编辑。根据激活模板自动生成内容类型：

| 模板 | CMS 后台 Collections |
|------|---------------------|
| blog | 文章、页面、关键字、友情链接、留言、站点设置 |
| xtocn | + 项目案例、服务项目、产品管理、开源项目 |

### 功能特性

- 📝 **文章** — 标题、描述、标签、封面图、置顶、草稿、外链
- 🎯 **项目案例** — 分类、客户、封面图、精选
- 🛠 **服务项目** — 分类、封面图、排序
- 📦 **产品管理** — 分类、价格、封面图
- 🔗 **SEO 关键字** — 关键字自动内链（每篇最多 3 次）
- 🔗 **友情链接** — 侧边栏展示，权重排序
- 💬 **留言管理** — 联系表单提交 → CMS 查看
- 🎨 **主题设置** — 颜色、字体、布局滑块可调
- 🧩 **模板管理** — 浏览、预览、切换、安装

---

## 架构

```
                    浏览器
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
    首页/列表        详情页           /admin
       │               │               │
       └───────────────┼───────────────┘
                       │
                  Astro SSR            ← 一个 Node 进程
                 模板链挂载 + 配置引擎
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
  src/content/     templates/      public/uploads/
  (*.md 文件)     (模板包)         (媒体文件)
```

- **没有数据库**：内容是 `.md` 文件，git 版本管理
- **没有 PHP**：Node.js 一把梭
- **模板链挂载**：Vite 插件在构建时沿继承链合并页面
- **配置管线**：三层 merge（核心 → 模板 → 用户）生成 CMS config

---

## 对比

| | WordPress | xtcms 1.0 |
|---|---|---|
| 运行环境 | PHP + MySQL + Apache/Nginx | Node.js 单进程 |
| 数据库 | 需要 | 不需要，文件即内容 |
| 内容格式 | 数据库 blob | Markdown，可读可迁移 |
| 页面速度 | 200ms~2s | 50~100ms |
| 模板系统 | 主题市场 10,000+ | 模板继承，社区共建 |
| 定制方式 | 插件 → 冲突 → 妥协 | 模板 extends + customizable 配置 |
| 迁移 | 导 SQL + 传文件 | git push / tar 打包 |
| 备份 | 数据库 + 文件双备份 | git commit 一条命令 |

---

## 项目文件

```
xtcms-1.0/
├── templates/                  # ★ 模板系统
│   ├── blog/                   #   内置基模板
│   │   ├── template.yml
│   │   ├── collections.yml
│   │   └── src/                #   layouts + pages + components
│   ├── xtocn/                  #   企业站模板 extends blog
│   │   ├── template.yml
│   │   ├── collections.yml     #   只定义新增的 collection
│   │   └── src/                #   只包含覆盖/新增的文件
│   └── .registry.json          #   模板注册表
├── src/
│   ├── core/                   # ★ xtcms 核心引擎
│   │   ├── content.ts          #   文件系统内容读取
│   │   ├── template-registry.ts #  模板注册表 + 继承链解析
│   │   ├── config-engine.ts    #   配置生成管线
│   │   ├── auto-link.ts        #   SEO 关键字自动内链
│   │   ├── vite-plugin.js      #   构建时模板链挂载
│   │   └── yaml.ts             #   YAML 解析
│   ├── pages/
│   │   ├── api/                #   CMS API（保留，不清除）
│   │   │   ├── cms/            #     auth/files/commit/upload
│   │   │   ├── contact.ts      #     联系表单提交
│   │   │   └── cms/templates/  #     模板管理 API
│   │   └── *.astro             #   模板页（构建时自动同步）
│   ├── content/                # 📝 内容文件（不属模板）
│   │   ├── posts/              #   文章
│   │   ├── pages/              #   页面
│   │   ├── projects/           #   案例
│   │   ├── services/           #   服务
│   │   ├── products/           #   产品
│   │   ├── keywords/           #   SEO 关键字
│   │   ├── links/              #   友情链接
│   │   ├── messages/           #   留言
│   │   ├── opensource/         #   开源项目
│   │   └── settings/           #   站点配置
│   └── middleware.ts
├── public/admin/               # CMS 前端
├── .xtcms/
│   ├── active-template.json    # 当前激活模板
│   └── overrides/              # 用户文件级覆盖（可选）
├── astro.config.mjs
├── ecosystem.config.cjs        # PM2 部署配置
└── package.json
```

---

## 环境变量

```env
PORT=4321
CMS_USER=admin
CMS_PASS=你的密码
CMS_SECRET=随机字符串
```

---

## 部署

### 生产构建

```bash
npm run build
```

输出在 `dist/server/entry.mjs`。

### PM2 部署（推荐）

```bash
npm run build
pm2 start ecosystem.config.cjs
```

后台切换模板时自动 rebuild + 重启，~15 秒生效。

### 宝塔面板

1. 宝塔软件商店 → Node.js 版本管理器 → 安装 Node 22
2. 上传 `dist/`、`public/`、`templates/`、`src/content/`、`.env`、`package.json`
3. 宝塔 → Node 项目 → 添加：启动文件 `dist/server/entry.mjs`，命令 `npm start`
4. 放行端口 + 反向代理

---

## 开源项目

xtcms 是雄韬 XTOCN 开源家族的核心项目：

| 项目 | 说明 |
|------|------|
| **XTCMS** | 本项目的上一代，服务于 [www.xtocn.com](https://www.xtocn.com) |
| **XTCRM** | AI 原生 CRM，五层智能闭环 |
| **B2B 诊断** | OpenClaw Skill，企业基因诊断 + PDF 报告 |
| **雄韬创作锚** | AI 辅助内容创作框架 |
| **雄韬易经** | 商业决策工具 |
| **企业头条** | AI 公关稿生成 |

---

## 开源治理

- **许可证**：Apache-2.0 — 商用友好，明确专利授权
- **社区驱动**：模板生态由社区共建，核心保持精简
- **治理文档**：GOVERNANCE.md / CONTRIBUTING.md / CODE_OF_CONDUCT.md

---

## License

Apache-2.0 © 2026 XTOCN Open Source Contributors
