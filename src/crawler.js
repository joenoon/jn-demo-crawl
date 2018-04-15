const {extractHrefs, extractImages, loadUrl} = require('./parsing');
const {redis} = require('./redis');

const MAX_DEPTH = 1;

class Crawler {
  constructor(job_id) {
    this.job_id = job_id;
  }

  get urls_key() {
    return `crawl:${this.job_id}:urls`;
  }

  get complete_key() {
    return `crawl:${this.job_id}:complete`;
  }

  get results_key() {
    return `crawl:${this.job_id}:results`;
  }

  async addUrlsToCrawl({urls, level}) {
    if (urls.length === 0) return 0;
    const {job_id, urls_key} = this;
    urls = [...new Set(urls)];
    const args = urls.reduce((accum, val) => [...accum, level, val], []);
    const number_added = await redis.zaddAsync(urls_key, 'nx', ...args);
    return number_added;
  }

  async addImagesForUrl({url, images}) {
    if (images.length === 0) return 0;
    const {job_id, urls_key} = this;
    const key = `${urls_key}:${url}:images`;
    images = [...new Set(images)];
    const now = Date.now();
    const args = images.reduce((accum, val) => [...accum, now, val], []);
    const number_added = await redis.zaddAsync(key, 'nx', ...args);
    return number_added;
  }

  // looks for the next url
  // if it doesnt exist or has a score of 100, exits
  // otherwise tries to change its score to 100
  // if succeeds, returns url and level, otherwise try again (race with other worker)
  async getNextUrl() {
    const {urls_key} = this;
    while (true) {
      const [url, score] = await redis.zrangeAsync(
        urls_key,
        0,
        0,
        'WITHSCORES'
      );
      if (!url || score === '100') break;
      const reply = await redis.zaddAsync(urls_key, 'CH', 100, url);
      if (reply === 1) {
        return {url, level: parseInt(score, 10)};
      }
    }
  }

  async stepCrawl() {
    const {job_id, urls_key} = this;

    const result = await this.getNextUrl();

    if (!result) {
      this.completeCrawl();
      return false;
    }

    const {url, level} = result;
    console.log('[crawl]      ', job_id, url, level);

    const doc = await loadUrl(url);
    if (doc) {
      const images = extractImages(url, doc);
      await this.addImagesForUrl({url, images});
      if (level < MAX_DEPTH) {
        const urls = extractHrefs(url, doc);
        await this.addUrlsToCrawl({urls, level: level + 1});
      }
    }

    return true;
  }

  async completeCrawl() {
    const {complete_key, results_key, job_id} = this;
    const reply = await redis.setAsync(complete_key, '1', 'NX');
    if (reply !== 'OK') return; // someone else completed it
    // we are the completer
    await this.cachedResults(); // trigger an eager cache
    console.log('[complete]   ', job_id);
    return true;
  }

  async calculateResults() {
    const {complete_key, urls_key} = this;
    const reply = await redis.getAsync(complete_key);
    if (reply !== '1') return;
    const urls = await redis.zrangeAsync(urls_key, 0, -1);
    let batch = redis.batch();
    for (const url of urls) {
      const key = `${urls_key}:${url}:images`;
      batch = batch.zrange(key, 0, -1);
    }
    const image_sets = await batch.execAsync();
    const results = {};
    urls.forEach((url, i) => {
      results[url] = image_sets[i];
    });
    return results;
  }

  async cachedResults() {
    const {results_key} = this;
    const reply = await redis.getAsync(results_key);
    if (reply) return JSON.parse(reply);
    const results = await this.calculateResults();
    if (results) {
      await redis.setAsync(results_key, JSON.stringify(results), 'NX');
    }
    return results;
  }

  async getStatus() {
    const {urls_key} = this;
    const reply = await redis
      .multi()
      .zcard(urls_key)
      .zcount(urls_key, '0', '(100')
      .execAsync();
    const [total, inprogress] = reply;
    const completed = total - inprogress;
    return {
      completed,
      inprogress,
    };
  }
}

module.exports = {
  Crawler,
};
