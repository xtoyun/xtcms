#!/usr/bin/env node
/**
 * Scaffold a new xtcms template.
 * Usage: node scripts/create-template.js my-template [--extends blog]
 */
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: node scripts/create-template.js <name> [--extends <parent>]');
  console.log('Example: node scripts/create-template.js my-enterprise --extends blog');
  process.exit(0);
}

const name = args[0];
const extendsIdx = args.indexOf('--extends');
const parent = extendsIdx >= 0 ? args[extendsIdx + 1] : 'blog';

const targetDir = path.join(process.cwd(), 'templates', name);

if (fs.existsSync(targetDir)) {
  console.error(`Error: Template "${name}" already exists at ${targetDir}`);
  process.exit(1);
}

// Create directory structure
const dirs = [
  'src/layouts',
  'src/pages',
  'src/components',
  'assets',
];

for (const dir of dirs) {
  fs.mkdirSync(path.join(targetDir, dir), { recursive: true });
}

// template.yml
const tplYaml = `name: ${name}
version: 0.1.0
type: custom
label: ${name}
description: A custom xtcms template
author: ""
license: MIT

extends: ${parent}

supports:
  - posts
  - pages

features:
  - responsive

customizable:
  colors:
    - { name: primary, label: 主色调, type: color, default: "#000000" }
    - { name: bg, label: 背景色, type: color, default: "#ffffff" }

  typography:
    - { name: heading_font, label: 标题字体, type: select, options: ["PingFang SC", "Noto Serif SC", "Microsoft YaHei"], default: "PingFang SC" }

requires:
  xtcms: ">=1.0.0"
`;

fs.writeFileSync(path.join(targetDir, 'template.yml'), tplYaml);

// collections.yml (empty — inherits from parent)
const collYaml = `# ${name} template collections
# Inherits all collections from "${parent}".
# Add new collections or override fields below.

collections: []
${parent !== 'blog' ? '' : `
# Example: add a new collection
# collections:
#   - name: my-collection
#     label: My Collection
#     folder: src/content/my-collection
#     create: true
#     fields:
#       - { label: 标题, name: title, widget: string }
#       - { label: 正文, name: body, widget: markdown }
`}
`;

fs.writeFileSync(path.join(targetDir, 'collections.yml'), collYaml);

// Override homepage
const indexAstro = `---
import BaseLayout from '$layouts/BaseLayout.astro';
import { getContent } from '$core/content';

const posts = getContent('posts', 'src/content/posts')
  .filter(p => !p.data.draft)
  .slice(0, 6);
---
<BaseLayout>
  <section style="padding: 60px 0;">
    <div style="max-width: 800px; margin: 0 auto; padding: 0 40px;">
      <h1 style="font-size: 36px; font-weight: 400; color: var(--xt-primary);">
        Welcome to ${name}
      </h1>
      <p style="font-size: 16px; color: var(--xt-muted); margin-bottom: 48px;">
        Extends: ${parent}
      </p>

      {posts.length > 0 ? (
        <div style="display: grid; gap: 32px;">
          {posts.map(post => (
            <article style="padding-bottom: 32px; border-bottom: 1px solid #f0f0f0;">
              <a href={post.data.link || \`/posts/\${post.slug}\`} style="text-decoration: none; color: inherit;">
                <time style="font-size: 13px; color: var(--xt-muted);">
                  {post.data.date ? new Date(post.data.date).toLocaleDateString('zh-CN') : ''}
                </time>
                <h2 style="font-size: 22px; font-weight: 500; color: var(--xt-primary); margin-top: 8px;">
                  {post.data.title}
                </h2>
                {post.data.description && (
                  <p style="font-size: 15px; color: var(--xt-muted); margin-top: 8px;">{post.data.description}</p>
                )}
              </a>
            </article>
          ))}
        </div>
      ) : (
        <p style="color: var(--xt-muted);">No posts yet.</p>
      )}
    </div>
  </section>
</BaseLayout>
`;

fs.writeFileSync(path.join(targetDir, 'src/pages/index.astro'), indexAstro);

// README
const readme = `# ${name}

A custom xtcms template extending **${parent}**.

## Install

\`\`\`bash
# Copy to your xtcms templates directory
cp -r ${name} templates/
# Activate
echo '{"name":"${name}","chain":["${parent}","${name}"]}' > .xtcms/active-template.json
# Restart dev server
npm run dev
\`\`\`

## Customize

Edit \`template.yml\` to change colors, fonts, layout. Override any parent template file by creating it in \`src/\`.
`;

fs.writeFileSync(path.join(targetDir, 'README.md'), readme);

// Register in .registry.json
const regPath = path.join(process.cwd(), 'templates', '.registry.json');
if (fs.existsSync(regPath)) {
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  reg.installed[name] = {
    name,
    label: name,
    version: '0.1.0',
    source: 'local',
    extends: parent,
    installedAt: new Date().toISOString(),
    path: `templates/${name}`,
  };
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 2));
  console.log(`Registered template "${name}" in .registry.json`);
}

console.log(`\n✅ Template "${name}" created at templates/${name}/`);
console.log(`   Extends: ${parent}`);
console.log(`\nNext steps:`);
console.log(`   1. Edit templates/${name}/template.yml`);
console.log(`   2. Add your pages to templates/${name}/src/pages/`);
console.log(`   3. Activate: update .xtcms/active-template.json chain to ["${parent}", "${name}"]`);
console.log(`   4. Restart: npm run dev`);
