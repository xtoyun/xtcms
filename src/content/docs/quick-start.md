---
title: 快速开始
order: 2
---

## 环境要求

| 项目 | 版本 |
|------|------|
| Node.js | >= 22.12.0 |
| npm | >= 9.0 |
| 操作系统 | Windows / macOS / Linux |

## 安装 Node.js（推荐 nvm）

**Windows**：下载 [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)

```bash
nvm install 22
nvm use 22
```

**macOS / Linux**：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install 22
nvm use 22
nvm alias default 22
```

## 安装 xtcms

```bash
git clone https://github.com/xtoyun/xtcms.git
cd xtcms-1.0
npm install
```

## 配置

```bash
cp .env.example .env
# 编辑 .env，修改密码
```

默认账号 `admin` / `admin`

## 启动

```bash
npm run dev
```

- 前端：`http://localhost:4321`
- 后台：`http://localhost:4321/admin`
