const UUID = require('node-uuid');
const {redis, blockingRedis} = require('./redis');

// jobHandlers is exported so it can be modified elsewhere.
// the form is:
// {
//   'myJobType': async (job) => doSomething,
// }
const jobHandlers = {};

// processes jobs serially, block-popping them off a redis fifo queue
async function waitForJob() {
  const result = await blockingRedis.blpopAsync('jobs', 10);
  if (result && result[1]) {
    const job = JSON.parse(result[1]);
    const handler = jobHandlers[job.type];
    if (handler) await handler(job);
  }
  process.nextTick(waitForJob);
}

// pushes a job onto the end of a redis fifo queue
function dispatchJob(job) {
  const job_id = job.job_id || UUID.v4();
  redis.rpush(
    'jobs',
    JSON.stringify({
      ...job,
      job_id,
    })
  );
  return job_id;
}

// start the job watcher
process.nextTick(waitForJob);

module.exports = {
  dispatchJob,
  jobHandlers,
};
