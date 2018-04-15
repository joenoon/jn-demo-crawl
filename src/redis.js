const Redis = require('redis');
const bluebird = require('bluebird');

bluebird.promisifyAll(Redis.RedisClient.prototype);
bluebird.promisifyAll(Redis.Multi.prototype);

const redis = Redis.createClient({host: 'redis'});
const blockingRedis = redis.duplicate();

// demo helper
// env FLUSHDB=1 ...
if (process.env.FLUSHDB === '1') {
  redis.flushdb();
}

module.exports = {
  Redis,
  redis,
  blockingRedis,
};
