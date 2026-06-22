# 贡献指南 / Contributing

感谢你考虑为 雄韬智网 贡献代码或文档！

## 行为准则

本项目遵循 [Contributor Covenant 行为准则](CODE_OF_CONDUCT.md)。所有参与者均需遵守。

## 如何贡献

### 报告 Bug

1. 在 [Issues](https://github.com/xtocn/xtcms/issues) 中搜索是否已有相同问题
2. 如果没有，新建 Issue，包含：
   - 环境信息（Node 版本、操作系统）
   - 复现步骤
   - 期望行为 vs 实际行为
   - 截图或日志

### 提交代码

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 提交变更：`git commit -m "feat: 简短描述"`
   - 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)：
     - `feat:` 新功能
     - `fix:` 修复
     - `docs:` 文档
     - `chore:` 构建/工具
4. 推送到你的 Fork：`git push origin feature/your-feature`
5. 创建 Pull Request 到本仓库的 `main` 分支

### PR 要求

- 代码风格与现有代码一致
- 新增功能需包含必要的测试或验证说明
- 避免包含个人环境配置文件（`.env`、IDE 配置等）

### 开发环境

```bash
git clone <your-fork>
cd xtcms
npm install
npm run dev
```

### 文档贡献

文档修改（README、GOVERNANCE 等）同样走 PR 流程。拼写修正等小改动可略过 Issue 直接提 PR。

## 审查流程

1. Maintainer 会在 1 周内进行初审
2. 可能需要修改或补充
3. 通过后由 Maintainer 合并

## 知识产权

提交代码即表示你确认拥有所提交内容的版权，并同意按 Apache-2.0 许可证授权。
