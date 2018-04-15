process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

process.on('unhandledRejection', err => {
  console.log('unhandledRejection', err);
});

const express = require('express');
const bodyParser = require('body-parser');
const {dispatchJob, jobHandlers} = require('./queue');
const {demoPause} = require('./demo');
const {Crawler} = require('./crawler');

const app = express();
app.set('json spaces', 2);
app.use(bodyParser.json());

// units of work

jobHandlers.startCrawl = async job => {
  const {
    job_id,
    data: {level, urls},
  } = job;
  const crawl = new Crawler(job_id);

  console.log('[job]        ', 'startCrawl', job_id, level, urls);
  const reply = await crawl.addUrlsToCrawl({
    urls,
    level,
  });
  if (reply > 0) {
    dispatchJob({
      job_id,
      type: 'stepCrawl',
    });
  }

  await demoPause();
};

jobHandlers.stepCrawl = async job => {
  const {job_id} = job;
  const crawl = new Crawler(job_id);

  console.log('[job]        ', 'stepCrawl', job_id);
  const keep_going = await crawl.stepCrawl();
  if (keep_going) {
    dispatchJob({
      job_id,
      type: 'stepCrawl',
    });
  }

  await demoPause();
};

// api

app.post('/jobs', (req, res) => {
  const id = dispatchJob({
    type: 'startCrawl',
    data: {
      level: 0,
      urls: req.body.urls,
    },
  });

  res.status(202).send({id});
});

app.get('/jobs/:job_id/status/', async (req, res) => {
  const {job_id} = req.params;
  if (!job_id) return res.status(500).send('Error');
  const crawler = new Crawler(job_id);
  const status = await crawler.getStatus();
  res.status(200).send({
    id: job_id,
    status,
  });
});

app.get('/jobs/:job_id/results/', async (req, res) => {
  const {job_id} = req.params;
  if (!job_id) return res.status(500).send('Error');
  const crawler = new Crawler(job_id);
  const results = await crawler.cachedResults();
  if (!results) return res.status(500).send('Not complete');
  res.status(200).send({
    id: job_id,
    results,
  });
});

app.listen(8080, () => {
  console.log(`server started at :8080`);
});

module.exports = app;
