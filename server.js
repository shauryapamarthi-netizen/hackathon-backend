require('dotenv').config();
const { createApp } = require('./lib/expressApp');

async function start() {
  const app = await createApp({ serveStatic: true });
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
