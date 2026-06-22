# 项目治理 / Governance

本文档定义 雄韬智网（XTOCN Website）项目的治理结构、角色权限与决策机制。

## 角色

| 角色 | 权限 | 产生方式 |
|------|------|---------|
| **Maintainer** | Merge PR、发布版本、管理 Issue、修改治理文档 | 由现有 Maintainer 共识提名，经 72 小时公开评论期无异议后晋升 |
| **Contributor** | 提交 PR、参与 Issue 讨论 | 任何提交被合并后自动成为 Contributor |
| **Community Member** | 提交 Issue、参与公共讨论 | 无门槛 |

## 决策机制

- **日常改动**：单一 Maintainer 审查通过即可合并（lazy consensus）
- **Breaking Change**：需在 Issue 中公示至少 72 小时，至少 2 名 Maintainer 同意
- **治理文档修改**：需全体 Maintainer 共识（≥ 2/3 同意）
- **争议**：无法达成共识时，由 Maintainer 中资历最深者做最终裁决，但需书面记录理由

## Maintainer 义务

1. 在合理时间内响应 Issue 和 PR（通常 1 周内）
2. 遵循项目行为准则（CODE_OF_CONDUCT.md）
3. 代码审查时给出建设性反馈
4. 保持公开沟通，避免私下决策

## 当前 Maintainer

| 姓名 | GitHub | 角色 |
|------|--------|------|
| XTOCN Team | [@xtocn](https://github.com/xtocn) | Lead Maintainer |

> 本项目欢迎新的 Maintainer 加入。如果你已持续贡献 ≥ 6 个月，可提名自己或他人。

## 项目独立性声明

本项目代码为原创开发，不包含任何雇佣关系下的职务作品。所有贡献者在提交代码时确认其拥有所提交内容的完整知识产权，并依据 Apache-2.0 许可证授权本项目使用。

本项目不由任何单一公司控制或拥有。商标"雄韬智网 / XTOCN"归项目社区所有，未经 Maintainer 共识书面许可不得用于商业背书。
