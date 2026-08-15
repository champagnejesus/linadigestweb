import { createServer } from 'http';
import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  console.log(line);
  try {
    const logPath = resolve(process.cwd(), 'startup.log');
    writeFileSync(logPath, line, { flag: 'a' });
    const parentLogPath = resolve(process.cwd(), '..', 'startup.log');
    writeFileSync(parentLogPath, line, { flag: 'a' });
  } catch(e) {}
}

process.on('uncaughtException', err => log(`Uncaught: ${err.stack}`));
process.on('unhandledRejection', err => log(`Unhandled Rejection: ${err.stack}`));

const port = process.env.PORT || 3000;
log(`Starting server. PORT env: ${process.env.PORT}, CWD: ${process.cwd()}, node: ${process.version}`);

const standalonePath = resolve(process.cwd(), 'dist', 'standalone', 'server.js');
const parentStandalonePath = resolve(process.cwd(), '..', 'dist', 'standalone', 'server.js');
const workerPath = resolve(process.cwd(), 'dist', 'server', 'index.js');
const parentWorkerPath = resolve(process.cwd(), '..', 'dist', 'server', 'index.js');

async function startServer() {
  log(`Paths to check:`);
  log(`- ${standalonePath} (exists: ${existsSync(standalonePath)})`);
  log(`- ${parentStandalonePath} (exists: ${existsSync(parentStandalonePath)})`);
  log(`- ${workerPath} (exists: ${existsSync(workerPath)})`);
  log(`- ${parentWorkerPath} (exists: ${existsSync(parentWorkerPath)})`);

  const actualStandalonePath = existsSync(standalonePath) ? standalonePath : (existsSync(parentStandalonePath) ? parentStandalonePath : null);

  if (actualStandalonePath) {
    log(`Importing standalone server from ${actualStandalonePath}...`);
    // Standalone server automatically listens on process.env.PORT, so just importing it runs it.
    await import(pathToFileURL(actualStandalonePath).href);
    log(`Standalone imported successfully. It should be listening on port ${port}.`);
    return;
  }

  const targetPath = existsSync(workerPath)
    ? workerPath
    : (existsSync(parentWorkerPath) ? parentWorkerPath : null);

  if (!targetPath) {
    log('Error: Build artifact not found. Run "npm run build" first.');
    process.exit(1);
  }

  log(`Target path selected: ${targetPath}`);
  log(`Importing worker module...`);
  const workerModule = await import(pathToFileURL(targetPath).href);
  log(`Worker module imported.`);
  
  const handler = workerModule.default;

  if (handler && typeof handler.fetch === 'function') {
    log(`Handler found with fetch. Creating server...`);
    const server = createServer(async (req, res) => {
      try {
        const host = req.headers.host || (typeof port === 'number' ? `localhost:${port}` : 'localhost');
        const url = new URL(req.url, `http://${host}`);

        let body = null;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const chunks = [];
          for await (const chunk of req) {
            chunks.push(chunk);
          }
          body = Buffer.concat(chunks);
        }

        const webRequest = new Request(url.href, {
          method: req.method,
          headers: req.headers,
          body: body,
          duplex: 'half',
        });

        const webResponse = await handler.fetch(webRequest, process.env, {});

        res.statusCode = webResponse.status;
        webResponse.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });

        const responseBuffer = Buffer.from(await webResponse.arrayBuffer());
        res.end(responseBuffer);
      } catch (err) {
        log(`Request handling error: ${err.stack || err}`);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    server.on('error', (err) => {
       log(`Server listen error: ${err.stack || err}`);
    });

    server.listen(port, () => {
      log(`Lina Digest server listening on port ${port}`);
    });
  } else {
    log('Error: Invalid worker export in dist/server/index.js');
    process.exit(1);
  }
}

startServer().catch((err) => {
  log(`Failed to start server: ${err.stack || err}`);
  process.exit(1);
});
