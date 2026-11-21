import { spawn, type ChildProcess } from 'child_process';
import express from 'express';
import http from 'http';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FASTAPI_HOST = '127.0.0.1';
const FASTAPI_PORT = Number(process.env.FASTAPI_INTERNAL_PORT || 8001);

function isPortOpen(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function ensureFastApiRunning(): Promise<ChildProcess | null> {
  const alreadyRunning = await isPortOpen(FASTAPI_PORT, FASTAPI_HOST);
  if (alreadyRunning) {
    return null;
  }

  const backendDir = path.resolve(__dirname, 'backend');
  const pythonBin = process.platform === 'win32' ? 'python' : 'python3';

  const proc = spawn(
    pythonBin,
    ['-m', 'uvicorn', 'app.main:app', '--host', FASTAPI_HOST, '--port', String(FASTAPI_PORT)],
    {
      cwd: backendDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
    }
  );

  proc.stdout?.on('data', (chunk) => {
    process.stdout.write(`[FastAPI] ${chunk}`);
  });
  proc.stderr?.on('data', (chunk) => {
    process.stderr.write(`[FastAPI] ${chunk}`);
  });

  // Wait up to 15 seconds for uvicorn to accept connections
  for (let i = 0; i < 30; i++) {
    if (await isPortOpen(FASTAPI_PORT, FASTAPI_HOST)) {
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return proc;
}

function proxyToFastApi(req: express.Request, res: express.Response) {
  const options: http.RequestOptions = {
    hostname: FASTAPI_HOST,
    port: FASTAPI_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${FASTAPI_HOST}:${FASTAPI_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode || 502);
    Object.entries(proxyRes.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        res.setHeader(key, value);
      }
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).json({
        detail: `FastAPI backend unavailable on port ${FASTAPI_PORT}: ${err.message}`,
      });
    }
  });

  req.pipe(proxyReq);
}

async function startServer() {
  const fastApiProc = await ensureFastApiRunning();

  const app = express();

  // Proxy FastAPI endpoints and Swagger docs before Vite/static middleware
  app.use('/api', proxyToFastApi);
  app.use('/docs', proxyToFastApi);
  app.use('/openapi.json', proxyToFastApi);

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const server = app.listen(3000, '0.0.0.0', () => {
    console.log('JourneySynth AI running on http://localhost:3000 (FastAPI proxy -> 127.0.0.1:8000)');
  });

  const cleanup = () => {
    server.close();
    if (fastApiProc && !fastApiProc.killed) {
      fastApiProc.kill('SIGTERM');
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startServer();
