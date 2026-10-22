import { env } from './config/env';
import { createContainer } from './container';
import { createApp } from './http/app';

const container = createContainer(env);
const server = createApp(container).listen(env.PORT, () => {
  console.log(`API SmartCampus prête sur http://localhost:${env.PORT} (adapters : ${env.ADAPTERS_MODE})`);
});

async function shutdown() {
  server.close();
  await container.dispose();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
