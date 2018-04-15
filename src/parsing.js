const fetch = require('node-fetch');
const cheerio = require('cheerio');
const URL = require('url');
const {redis} = require('./redis');

// load url from cache or fetch
async function loadUrl(url) {
  const key = `html:${url}`;
  const html = await redis.getAsync(key);
  if (html) return cheerio.load(html);
  try {
    const res = await fetch(url);
    const html = await res.text();
    await redis.setAsync(key, html);
    return cheerio.load(html);
  } catch (err) {
    console.warn(`Error in loadUrl, skipping ${url}:`, err);
  }
}

function extractHrefs(originUrl, doc) {
  const hrefs = doc('a')
    .map(function() {
      const href = doc(this).attr('href');
      if (!href) return;
      const abs = URL.resolve(originUrl, href);
      if (!abs.startsWith('http')) return;
      return abs;
    })
    .get();
  return hrefs;
}

function extractImages(originUrl, doc) {
  const images = doc('img')
    .map(function() {
      const src = doc(this).attr('src');
      if (!src) return;
      const abs = URL.resolve(originUrl, src);
      if (!abs.startsWith('http')) return;
      const {pathname} = URL.parse(abs);
      if (/(gif|jpg|png)$/i.test(pathname)) {
        return abs;
      }
    })
    .get();
  return images;
}

module.exports = {
  loadUrl,
  extractHrefs,
  extractImages,
};
