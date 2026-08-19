const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = process.env.PRERENDER_PORT || 4173;
const DIST = path.join(process.cwd(), 'dist');

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURI(req.url.split('?')[0]);
    let filePath = path.join(DIST, urlPath);
    // If path is directory, serve index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    // If request is /, serve dist/index.html
    if (urlPath === '/' || urlPath === '') {
      filePath = path.join(DIST, 'index.html');
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'image/png';
      res.setHeader('Content-Type', contentType);
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

(async () => {
  const routes = ['/', '/about.html'];
  console.log('Starting static server...');
  const server = await startStaticServer();
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  try {
    for (const route of routes) {
      const url = `http://localhost:${PORT}${route}`;
      console.log('Rendering', url);
      await page.goto(url, { waitUntil: 'networkidle' });
      const html = await page.content();
      const outPath = route === '/' ? path.join(DIST, 'index.html') : path.join(DIST, route.replace(/^\//, ''));
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');
      console.log('Wrote', outPath);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await browser.close();
    server.close();
    console.log('Prerender complete');
  }
})();
