// helpers for demo
// env DEMO_PAUSE=1000 node ...

async function doTimeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const DEMO_PAUSE = parseInt(process.env.DEMO_PAUSE || 0, 10);

async function demoPause() {
  if (DEMO_PAUSE === 0) return;
  await doTimeout(DEMO_PAUSE);
}

module.exports = {
  demoPause,
  doTimeout,
};
