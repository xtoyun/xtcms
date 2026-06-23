/**
 * Frontend i18n — Text translations for template pages.
 * Same locale detection as CMS: reads ?locale= param or Accept-Language header.
 */

const zhToEn: Record<string, string> = {
  '首页': 'Home', '文章': 'Posts', '关于': 'About',
  '联系': 'Contact', '留言': 'Message', '开源': 'Open Source',
  '项目': 'Projects', '服务': 'Services', '产品': 'Products',
  '最新文章': 'Latest Posts', '查看全部': 'View All', '返回首页': 'Back to Home',
  '返回文章列表': 'Back to Posts', '返回项目列表': 'Back to Projects',
  '返回服务列表': 'Back to Services', '返回产品中心': 'Back to Products',
  '返回开源项目': 'Back to Open Source', '联系我们': 'Contact Us',
  '请告诉您的需求': 'Tell us about your project',
  '我们为你提供更好服务': 'We provide better services for you',
  '马上联系': 'Get in Touch',
  '站点设置': 'Site Settings', '页面导航': 'Pages',
  '还没有文章，在管理后台开始写作吧': 'No posts yet. Start writing in the admin panel.',
  '还没有文章': 'No posts yet',
  '项目案例即将上线': 'Projects coming soon',
  '服务项目即将更新': 'Services coming soon',
  '产品即将上线': 'Products coming soon',
  '暂无正文内容': 'No content yet',
  '暂无内容': 'No content',
  '详细内容即将更新，敬请期待': 'Detailed content coming soon',
  '记录思考，分享知识': 'Thoughts and stories',
  '共': '', '篇文章': '',
  '个': '',
  '款产品': '',
  '期待与您的合作': 'Looking forward to working with you',
};

export function t(text: string, locale: string): string {
  if (locale === 'en') {
    // Handle patterns like "共 N 篇文章"
    const countMatch = text.match(/^共 (\d+) 篇文章$/);
    if (countMatch) return `${countMatch[1]} posts`;
    const prodMatch = text.match(/^共 (\d+) 款产品$/);
    if (prodMatch) return `${prodMatch[1]} products`;
    const projMatch = text.match(/^共 (\d+) 个项目$/);
    if (projMatch) return `${projMatch[1]} projects`;

    return zhToEn[text] ?? text;
  }
  return text;
}

export function getFrontendLocale(request: Request): string {
  // 1. URL param (?locale=en)
  const match = request.url.match(/[?&]locale=(en|zh)/);
  if (match) return match[1];
  // 2. Cookie (set by CMS when language is chosen)
  const cookie = request.headers.get('cookie') || '';
  const cookieMatch = cookie.match(/xtcms-locale=(en|zh)/);
  if (cookieMatch) return cookieMatch[1];
  // 3. Browser language
  const header = request.headers.get('accept-language') || '';
  if (header.toLowerCase().startsWith('en')) return 'en';
  return 'zh';
}
