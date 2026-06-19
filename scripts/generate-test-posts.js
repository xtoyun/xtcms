/**
 * Test data generator for xtcms pagination testing.
 *
 * Usage:
 *   node scripts/generate-test-posts.js --count 10000
 *   node scripts/generate-test-posts.js --clean
 *
 * Generates realistic markdown files in src/content/posts/ with frontmatter
 * and body content, suitable for testing list pagination with 10k+ entries.
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const POSTS_DIR = path.join(process.cwd(), 'src/content/posts');
const FILE_PREFIX = 'test-post-'; // Distinct prefix for identification and cleanup

// Tags pool (Chinese B2B/digital marketing tags)
const TAG_POOL = [
  '数字化转型', 'B2B', '网络营销', 'SEO', '品牌建设', '网站建设',
  '社交媒体', '数据分析', '制造业', 'SaaS', '跨境电商', '工业自动化',
  '医疗器械', '新能源', '企业服务', '供应链', 'AI应用', '物联网',
  '小程序', '短视频营销', '内容营销', '私域运营', '客户管理',
];

// Title templates: [Prefix] [Topic] [Suffix]
const TITLE_PARTS = {
  prefix: [
    '如何', 'B2B企业如何', '企业如何通过', '为什么', '怎样用',
    '中小企业', '传统制造业', '科技公司', '', '', '',
  ],
  topic: [
    '数字化转型', '网络营销', '品牌建设', '客户获取', '私域流量',
    '短视频营销', 'SEO优化', '社交媒体运营', '数据分析', '自动化营销',
    '内容策略', '小程序开发', '网站改版', 'AI赋能', '供应链管理',
    '在线获客', '用户增长', '降本增效', '跨境出海', '工业互联网',
    '粉丝经济', '微信生态', '直播带货', '智能客服', '远程协作',
  ],
  suffix: [
    '提升业绩', '实现增长', '降本增效', '弯道超车', '突破瓶颈',
    '赢得市场', '快速落地', '的方法论', '的实战经验', '的三步策略',
  ],
};

// Body paragraph templates
const BODY_PARAGRAPHS = [
  `## 背景

在当前数字化浪潮下，越来越多的企业开始意识到数字化转型不仅仅是技术升级，更是企业战略层面的深刻变革。传统企业面临着来自互联网原生企业的激烈竞争，用户需求也在快速变化。

数字化转型需要从三个维度来考虑：技术维度、组织维度和业务维度。技术是底座，组织是保障，业务是目的。三者缺一不可。

## 核心观点

首先，企业需要明确自己的核心竞争力是什么。是技术能力？是行业理解？还是解决问题的能力？这决定了企业数字化转型的方向和优先级。

其次，数字化转型不是一蹴而就的工程。它需要分阶段、有节奏地推进。一般来说可以分为三个阶段：数字化基础建设阶段、数字化运营阶段、数字化创新阶段。

## 实践建议

在实际操作中，我们建议企业从以下几个方面入手：

1. 建立数字化团队或部门，由高层直接推动
2. 选择一两个痛点场景作为切入点，快速验证
3. 在取得初步成效后，逐步扩展到更多业务场景
4. 持续投入人才和资源，保持技术迭代

## 总结

数字化转型是一场马拉松，不是百米冲刺。企业需要有足够的耐心和定力，在正确的方向上持续投入，才能最终获得回报。`,

  `## 行业分析

我们观察到，在当前的经济环境下，B2B企业的营销模式正在发生深刻变化。传统的展会营销、电话销售、上门拜访等方式效果逐渐下降，而数字化营销手段正在成为主流。

特别是在疫情之后，线上获客已经成为B2B企业的标配。根据行业调研数据，超过70%的B2B买家在接触销售之前会先进行在线调研。这意味着，如果企业在线上没有足够的存在感和专业形象，将失去大量潜在客户。

## 策略建议

针对这一趋势，我们提出以下策略：

1. 建设专业的企业官网，展示核心能力和案例
2. 通过内容营销建立行业影响力
3. 利用SEO和SEM获取精准流量
4. 构建私域流量池，持续运营

这些策略不是孤立的，而是需要形成一个完整的闭环。从引流到转化，从成交到复购，每个环节都需要数字化的支撑。

## 落地要点

在落地执行时，最重要的是保持一致性。品牌的视觉形象、内容风格、服务质量，都要保持统一的标准。同时，数据驱动决策也是关键——要通过数据来验证每一个策略的效果，及时调整优化。`,

  `## 技术思考

随着AI技术的快速发展，B2B营销领域也在经历深刻的变革。从智能客服到个性化推荐，从自动化营销到预测分析，AI正在重塑B2B营销的每一个环节。

但是，技术始终是工具，不是目的。企业在引入AI技术时，需要思考的核心问题是：这项技术能为客户创造什么价值？能帮助企业解决什么实际问题？

## 应用场景

目前，AI在B2B营销领域的应用主要集中在以下几个方面：

1. 客户画像与精准营销
2. 内容生成与优化
3. 智能客服与会话机器人
4. 销售预测与线索评分
5. 个性化推荐系统

这些应用场景的选择和优先级，需要根据企业自身的业务特点和资源禀赋来决定。

## 实践案例

我们最近服务的一家制造业客户，通过部署AI驱动的个性化内容推荐系统，将网站转化率提升了35%。这个效果的取得，不是因为技术本身有多先进，而是因为我们帮助客户找到了最合适的应用场景。`,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[rand(0, arr.length - 1)];
}

function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomDate(daysBack = 730) {
  const now = Date.now();
  const offset = rand(0, daysBack) * 24 * 60 * 60 * 1000;
  return new Date(now - offset).toISOString().slice(0, 10);
}

function generateTitle() {
  const p = TITLE_PARTS;
  const prefix = pick(p.prefix);
  const topic = pick(p.topic);
  const suffix = pick(p.suffix);
  // Avoid awkward empty prefix combinations
  if (prefix) {
    return `${prefix}${topic}${suffix}`;
  }
  return `${topic}${suffix}`;
}

function generateTags() {
  const count = rand(1, 3);
  return pickN(TAG_POOL, count);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function generatePost(index, total) {
  const paddedIndex = String(index).padStart(5, '0');
  const date = randomDate();
  const tags = generateTags();
  const pinned = Math.random() < 0.05; // 5% pinned
  const draft = Math.random() < 0.10;  // 10% draft
  const body = pick(BODY_PARAGRAPHS);
  const title = `${generateTitle()} (#${paddedIndex})`;

  const frontmatter = {
    title,
    description: `这是第${index}篇测试文章，涵盖${tags.join('、')}等主题`,
    date,
    tags,
    pinned,
    draft,
  };

  const yamlStr = yaml.dump(frontmatter, { lineWidth: -1, quotingType: '"' });
  return `---\n${yamlStr}---\n\n${body}`;
}

function generateFiles(count) {
  fs.mkdirSync(POSTS_DIR, { recursive: true });

  const batchSize = 500;
  const totalBatches = Math.ceil(count / batchSize);

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * batchSize + 1;
    const end = Math.min((batch + 1) * batchSize, count);

    for (let i = start; i <= end; i++) {
      const filename = `${FILE_PREFIX}${String(i).padStart(5, '0')}.md`;
      const content = generatePost(i, count);
      fs.writeFileSync(path.join(POSTS_DIR, filename), content, 'utf8');
    }

    process.stdout.write(`\r  生成进度: ${end}/${count} (${Math.round(end / count * 100)}%)`);
  }
  console.log('');
}

function cleanFiles() {
  if (!fs.existsSync(POSTS_DIR)) {
    console.log('posts 目录不存在，无需清理');
    return 0;
  }

  let removed = 0;
  for (const entry of fs.readdirSync(POSTS_DIR)) {
    if (entry.startsWith(FILE_PREFIX) && entry.endsWith('.md')) {
      fs.unlinkSync(path.join(POSTS_DIR, entry));
      removed++;
    }
  }
  return removed;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const countArg = args.indexOf('--count');
const cleanArg = args.includes('--clean');

if (cleanArg) {
  console.log('清理测试文章...');
  const removed = cleanFiles();
  console.log(`已删除 ${removed} 篇测试文章`);
  process.exit(0);
}

if (countArg === -1) {
  console.log([
    '用法:',
    '  node scripts/generate-test-posts.js --count 10000    生成 N 篇测试文章',
    '  node scripts/generate-test-posts.js --clean           清理所有测试文章',
  ].join('\n'));
  process.exit(1);
}

const count = parseInt(args[countArg + 1], 10);
if (isNaN(count) || count < 1) {
  console.error('错误: --count 需要一个正整数');
  process.exit(1);
}

// Confirm for large amounts
if (count > 1000) {
  const existing = fs.existsSync(POSTS_DIR)
    ? fs.readdirSync(POSTS_DIR).filter(f => f.startsWith(FILE_PREFIX)).length
    : 0;
  if (existing > 0) {
    console.log(`注意: 目录中已有 ${existing} 篇测试文章，将在此基础上新增 ${count} 篇`);
  }
}

console.log(`开始生成 ${count} 篇测试文章到 ${POSTS_DIR}...`);
const startTime = Date.now();

generateFiles(count);

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.log(`完成! 耗时 ${elapsed}s`);

// Show stats
const totalFiles = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md')).length;
const dirSize = fs.readdirSync(POSTS_DIR)
  .filter(f => f.endsWith('.md'))
  .reduce((sum, f) => sum + fs.statSync(path.join(POSTS_DIR, f)).size, 0);

console.log(`目录统计: ${totalFiles} 个 .md 文件, 总大小 ${(dirSize / 1024 / 1024).toFixed(1)} MB`);
