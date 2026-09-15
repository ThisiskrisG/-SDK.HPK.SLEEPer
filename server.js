const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT || 3000);
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || path.join(__dirname, 'game-files'));
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || path.join(__dirname, 'public'));
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const DOWNLOAD_TOKEN = process.env.DOWNLOAD_TOKEN || '';
const PUBLIC_DOWNLOADS = process.env.PUBLIC_DOWNLOADS !== 'false';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 1024 * 1024 * 1024);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip',
  '.wasm': 'application/wasm',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

function send(res, statusCode, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(statusCode, {
    'content-type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'access-control-allow-origin': CORS_ORIGIN,
    'access-control-allow-methods': 'GET,PUT,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,x-admin-token,x-download-token',
    ...headers,
  });
  res.end(payload);
}

function json(res, statusCode, body) {
  send(res, statusCode, body, { 'content-type': 'application/json; charset=utf-8' });
}

function isSafeFileName(fileName) {
  return Boolean(fileName) && fileName === path.basename(fileName) && !fileName.startsWith('.') && !fileName.includes('\0');
}

function filePathFor(fileName) {
  if (!isSafeFileName(fileName)) {
    return null;
  }
  return path.join(STORAGE_DIR, fileName);
}

function hasToken(req, headerName, expectedToken) {
  return Boolean(expectedToken) && req.headers[headerName] === expectedToken;
}

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) {
    json(res, 500, { error: 'ADMIN_TOKEN is not configured on the server.' });
    return false;
  }
  if (!hasToken(req, 'x-admin-token', ADMIN_TOKEN)) {
    json(res, 401, { error: 'Missing or invalid admin token.' });
    return false;
  }
  return true;
}

function canDownload(req, url) {
  if (PUBLIC_DOWNLOADS) {
    return true;
  }
  return hasToken(req, 'x-download-token', DOWNLOAD_TOKEN) || (DOWNLOAD_TOKEN && url.searchParams.get('token') === DOWNLOAD_TOKEN);
}

async function listFiles() {
  await fsp.mkdir(STORAGE_DIR, { recursive: true });
  const entries = await fsp.readdir(STORAGE_DIR, { withFileTypes: true });
  const files = await Promise.all(entries
    .filter((entry) => entry.isFile() && isSafeFileName(entry.name))
    .map(async (entry) => {
      const fullPath = path.join(STORAGE_DIR, entry.name);
      const stat = await fsp.stat(fullPath);
      return {
        name: entry.name,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        downloadUrl: `/api/files/${encodeURIComponent(entry.name)}`,
      };
    }));
  return files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health') {
    json(res, 200, { ok: true, storageDir: STORAGE_DIR, publicDownloads: PUBLIC_DOWNLOADS });
    return;
  }

  if (url.pathname === '/api/files' && req.method === 'GET') {
    json(res, 200, { files: await listFiles(), publicDownloads: PUBLIC_DOWNLOADS });
    return;
  }

  const match = url.pathname.match(/^\/api\/files\/([^/]+)$/);
  if (!match) {
    json(res, 404, { error: 'API route not found.' });
    return;
  }

  const fileName = decodeURIComponent(match[1]);
  const fullPath = filePathFor(fileName);
  if (!fullPath) {
    json(res, 400, { error: 'Invalid file name. Use a single file name without folders.' });
    return;
  }

  if (req.method === 'GET') {
    if (!canDownload(req, url)) {
      json(res, 401, { error: 'Missing or invalid download token.' });
      return;
    }
    try {
      const stat = await fsp.stat(fullPath);
      res.writeHead(200, {
        'content-type': MIME_TYPES[path.extname(fileName).toLowerCase()] || 'application/octet-stream',
        'content-length': stat.size,
        'content-disposition': `attachment; filename="${fileName.replace(/"/g, '')}"`,
        'access-control-allow-origin': CORS_ORIGIN,
      });
      fs.createReadStream(fullPath).pipe(res);
    } catch (error) {
      if (error.code === 'ENOENT') {
        json(res, 404, { error: 'File not found.' });
      } else {
        throw error;
      }
    }
    return;
  }

  if (req.method === 'PUT') {
    if (!requireAdmin(req, res)) {
      return;
    }
    await fsp.mkdir(STORAGE_DIR, { recursive: true });
    const tempPath = path.join(STORAGE_DIR, `.${crypto.randomUUID()}.upload`);
    let received = 0;
    const writeStream = fs.createWriteStream(tempPath, { flags: 'wx' });

    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_UPLOAD_BYTES) {
        req.destroy(new Error(`Upload exceeds ${MAX_UPLOAD_BYTES} byte limit.`));
      }
    });

    req.pipe(writeStream);

    try {
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        req.on('error', reject);
      });
      await fsp.rename(tempPath, fullPath);
      const stat = await fsp.stat(fullPath);
      json(res, 201, { name: fileName, size: stat.size, updatedAt: stat.mtime.toISOString() });
    } catch (error) {
      await fsp.rm(tempPath, { force: true });
      json(res, 413, { error: error.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) {
      return;
    }
    await fsp.rm(fullPath, { force: true });
    json(res, 200, { deleted: fileName });
    return;
  }

  json(res, 405, { error: 'Method not allowed.' });
}

async function serveStatic(req, res, url) {
  const requestedPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const normalizedPath = path.normalize(decodeURIComponent(requestedPath)).replace(/^([.][.][/\\])+/, '');
  const fullPath = path.join(PUBLIC_DIR, normalizedPath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    send(res, 403, 'Forbidden');
    return;
  }

  try {
    const stat = await fsp.stat(fullPath);
    if (!stat.isFile()) {
      send(res, 404, 'Not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME_TYPES[path.extname(fullPath).toLowerCase()] || 'application/octet-stream',
      'content-length': stat.size,
      'access-control-allow-origin': CORS_ORIGIN,
    });
    fs.createReadStream(fullPath).pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') {
      send(res, 404, 'Not found');
    } else {
      throw error;
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      send(res, 204, '');
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: 'Internal server error.' });
  }
});

server.listen(PORT, () => {
  console.log(`PhonexOS file server listening on http://localhost:${PORT}`);
  console.log(`Serving files from ${STORAGE_DIR}`);
});
