// Production entrypoint: wire real adapters, start the execution-plane worker and
// the control-plane HTTP/SSE server. Requires infra (Postgres/Redis) + keys.

import { buildApp, startWorker, createControlPlaneServer } from './index';
import { loadConfig } from './config';

function main(): void {
  const app = buildApp();
  startWorker(app.workerDeps);

  const port = loadConfig().port;
  const server = createControlPlaneServer(app.controlPlane);
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`agent-os control plane listening on :${port} (worker started)`);
  });
}

if (require.main === module) main();
