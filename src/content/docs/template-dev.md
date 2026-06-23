---
title: 模板开发
order: 6
---

## template.yml

```yaml
name: my-enterprise
version: 1.0.0
type: enterprise
label: 我的模板
extends: blog

customizable:
  colors:
    - { name: primary, label: 主色调, type: color, default: "#000" }
  typography:
    - { name: heading_font, label: 标题字体, type: select, options: ["PingFang SC", "Inter"], default: "PingFang SC" }
```

## collections.yml

```yaml
collections:
  - name: projects
    label: 项目案例
    folder: src/content/projects
    create: true
    fields:
      - { label: 标题, name: title, widget: string }
      - { label: 封面图, name: image, widget: image, required: false }
      - { label: 正文, name: body, widget: markdown, required: false }
```

## 字段类型

| widget | 说明 |
|--------|------|
| `string` | 单行文本 |
| `text` | 多行文本 |
| `markdown` | Markdown 编辑器 |
| `image` | 图片上传 |
| `datetime` | 日期选择 |
| `select` | 下拉选择 |
| `boolean` | 复选框 |
| `number` | 数字 |
| `list` | 标签列表 |
| `relation` | 关联选择（搜索下拉） |

## 写页面

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getContent } from '../core/content';

const posts = getContent('posts', 'src/content/posts');
---

<BaseLayout>
  <h1>Welcome</h1>
  {posts.map(p => (
    <article>
      <h2>{p.data.title}</h2>
    </article>
  ))}
</BaseLayout>
```
