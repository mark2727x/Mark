/**
 * Static file server for the ShiftGuard Expo web build.
 * Serves the output of `expo export --platform web --output-dir web-build`
 * with SPA-style fallback to index.html for client-side routes.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'web-build');
const INDEX_HTML = path.join(ROOT, 'index.html');
const PORT = parseInt(process.env.PORT || '3000', 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
};

const indexHtml = fs.readFileSync(INDEX_HTML, 'utf-8');

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  const safe = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(ROOT, safe);

  if (
    filePath.startsWith(ROOT) &&
    pathname !== '/' &&
    fs.existsSync(filePath) &&
    fs.statSync(filePath).isFile()
  ) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control':
        ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    res.end(fs.readFileSync(filePath));
    return;
  }

  // SPA fallback -> index.html
  res.writeHead(200, {
    'content-type': MIME['.html'],
    'cache-control': 'no-cache',
  });
  res.end(indexHtml);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ShiftGuard web serving from ${ROOT} on :${PORT}`);
});
