/**
 * ShiftGuard preview dashboard (port 3000).
 *
 * This is a lightweight demo web UI so the preview URL renders something
 * useful. The real product is a native Expo mobile app in artifacts/mobile;
 * this page proves the API is up and lets you exercise the Stripe flow
 * from a browser (register, login, create a shift, pay with Checkout).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HTML_PATH = path.join(__dirname, 'preview.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const html = fs.readFileSync(HTML_PATH, 'utf-8');

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const pathname = url.pathname;

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'content-type': MIME['.html'] });
    res.end(html);
    return;
  }

  // Serve any co-located static asset (favicon, css, etc.) if we add them
  const safe = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = path.join(__dirname, safe);
  if (file.startsWith(__dirname) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
    return;
  }

  // Everything else -> SPA fallback
  res.writeHead(200, { 'content-type': MIME['.html'] });
  res.end(html);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ShiftGuard preview dashboard listening on :${PORT}`);
});
