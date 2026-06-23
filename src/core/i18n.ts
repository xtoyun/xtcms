/**
 * xtcms i18n — Label translations for CMS collections.
 * Chinese is the canonical language. English translations via the zhToEn map.
 */

export type Locale = 'zh' | 'en';

const zhToEn: Record<string, string> = {
  '文章': 'Posts', '页面管理': 'Pages', '页面': 'Page',
  'SEO关键字': 'SEO Keywords', '关键字': 'Keyword',
  '留言管理': 'Messages', '留言': 'Message',
  '友情链接': 'Friends Links', '链接': 'Link',
  '基本信息': 'General', '页脚设置': 'Footer',
  '社交媒体': 'Social Media', '站点设置': 'Settings',
  '标题': 'Title', '描述': 'Description',
  '发布日期': 'Date', '标签': 'Tags',
  '封面图': 'Cover Image', '置顶': 'Pinned',
  '草稿': 'Draft', '外部链接': 'External Link',
  '正文': 'Content', '姓名': 'Name', '公司': 'Company',
  '电话': 'Phone', '邮箱': 'Email', '已读': 'Read',
  '留言内容': 'Message', '网站名称': 'Site Name',
  '网址': 'URL', '排序': 'Order',
  '网站标题': 'Site Title', '网站描述': 'Site Description',
  'ICP备案号': 'ICP License', '公安备案号': 'Police License',
  '版权文字': 'Copyright', '微信二维码': 'WeChat QR',
  '分类': 'Category', '客户': 'Client', '精选': 'Featured',
  '价格': 'Price', '联系邮箱': 'Email', '联系电话': 'Phone',
  '项目案例': 'Projects', '项目': 'Project',
  '服务项目': 'Services', '服务': 'Service',
  '产品管理': 'Products', '产品': 'Product',
  '开源项目': 'Open Source', '作品展示': 'Works', '作品': 'Work',
  '客户评价': 'Testimonials', '评价': 'Testimonial',
  '置顶文章': 'Pinned', '文章列表': 'All Posts',
  '未读留言': 'Unread', '已读留言': 'Read',
  '全部作品': 'All Works', '精选作品': 'Featured',
  '首页设置': 'Homepage Settings', '首页大标题': 'Hero Title',
  '首页副标题': 'Hero Subtitle', '个人介绍': 'About Text',
  '展示作品数量': 'Works Count',
  '页面标题': 'Title', '精选项目': 'Featured',
  '项目名称': 'Title', '产品名称': 'Title', '服务名称': 'Title',
};

export function t(label: string, locale: Locale): string {
  if (locale === 'en') return zhToEn[label] ?? label;
  return label;
}

/**
 * Get locale from URL parameter — set by CMS admin page JS based on navigator.language.
 * This mirrors Sveltia CMS's own locale detection.
 */
export function getLocale(request?: Request): Locale {
  if (request) {
    const match = request.url.match(/[?&]locale=(en|zh)/);
    if (match) return match[1] as Locale;
  }
  return 'zh';
}

export function translateConfig(obj: any, locale: Locale): any {
  if (Array.isArray(obj)) return obj.map(item => translateConfig(item, locale));
  if (obj && typeof obj === 'object') {
    const translated: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if ((key === 'label' || key === 'label_singular') && typeof value === 'string') {
        translated[key] = t(value, locale);
      } else {
        translated[key] = translateConfig(value, locale);
      }
    }
    return translated;
  }
  return obj;
}
