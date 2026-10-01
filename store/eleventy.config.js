import config from './store.config.js';
import { catalogue, packList } from './catalogue.js';
import { FORMATS } from './engine/export/index.js';

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ 'site/static': '/' });
  eleventyConfig.addGlobalData('store', config);
  eleventyConfig.addGlobalData('catalogue', catalogue);
  eleventyConfig.addGlobalData('packs', packList);
  eleventyConfig.addGlobalData('formats', FORMATS);
  eleventyConfig.addGlobalData('dev', () => process.env.STORE_DEV === '1');
  eleventyConfig.addFilter('price', (n) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`);
  eleventyConfig.addFilter('json', (v) => JSON.stringify(v));
  return {
    dir: { input: 'site', includes: '_includes', data: '_data', output: 'dist' },
    templateFormats: ['njk', 'md'],
    htmlTemplateEngine: 'njk',
  };
}
