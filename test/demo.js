const fetch = require('node-fetch');
const {doTimeout} = require('../src/demo');

const BASE = 'http://api:8080';

async function jsonFetch(path, opts = {}) {
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
  }
  const url = `${BASE}${path}`;

  const res = await fetch(url, {
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    ...opts,
  });
  const status = res.status;
  const body = await res.json();
  return {url, status, body};
}

function logResult(obj) {
  console.log('-----------------');
  console.log(JSON.stringify(obj, null, 2));
}

async function main() {
  let res, job_id;

  // create a new job

  res = await jsonFetch('/jobs', {
    method: 'POST',
    body: {
      urls: [
        // 'https://s3.amazonaws.com/jn-demo-crawl/index1.html',
        // 'https://s3.amazonaws.com/jn-demo-crawl/index1.html',
        // 'https://s3.amazonaws.com/jn-demo-crawl/index1.html',
        // 'https://s3.amazonaws.com/jn-demo-crawl/index1.html',
        // 'https://notfound/index.html',
        'https://google.com',
        'https://www.statuspage.io',
        'https://travis-ci.org',
      ],
    },
  });
  logResult(res);
  job_id = res.body.id;

  // poll status until complete

  let status_same = 0;

  while (status_same < 3) {
    res = await jsonFetch(`/jobs/${job_id}/status/`);
    logResult(res);
    if (res.body.status.completed > 0 && res.body.status.inprogress === 0) {
      status_same += 1;
    }
    await doTimeout(500);
  }

  // get results

  while (true) {
    try {
      res = await jsonFetch(`/jobs/${job_id}/results/`);
      logResult(res);
      break;
    } catch (err) {
      console.log('waiting for result...');
      await doTimeout(200);
    }
  }
}

main();
