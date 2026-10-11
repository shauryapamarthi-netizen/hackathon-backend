require('dotenv').config();
const { createApp } = require('../lib/expressApp');

let appPromise = null;

module.exports = async (req, res) => {
  if (!appPromise) {
    appPromise = createApp({ serveStatic: false });
  }
  const app = await appPromise;
  return app(req, res);
};
