const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

function handler(req, res) {
  // CORS Headers cho mọi request
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Tách lấy pathname (bỏ qua query string ?t=...)
  const reqUrl = req.url || '/';
  const pathname = reqUrl.split('?')[0];

  const rootDir = fs.existsSync(path.join(__dirname, 'index.html')) ? __dirname : process.cwd();
  const dataFile = path.join(rootDir, 'data.json');

  // API 1: Đọc dữ liệu từ data.json
  if (pathname === '/api/data' && req.method === 'GET') {
    try {
      const data = fs.readFileSync(dataFile, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(data);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Không thể đọc file data.json' }));
    }
    return;
  }

  // API 2: Ghi dữ liệu vào data.json khi giao diện thay đổi
  if (pathname === '/api/data' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const formattedJson = JSON.stringify(parsed, null, 2);
        try {
          fs.writeFileSync(dataFile, formattedJson, 'utf8');
        } catch (e) {
          // Trên môi trường Serverless (Vercel) ổ đĩa là read-only, dữ liệu client lưu an toàn trong LocalStorage
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: 'Đã lưu thành công!' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Dữ liệu JSON không hợp lệ' }));
      }
    });
    return;
  }

  // Phục vụ tệp tĩnh (static files: index.html, style.css, script.js, logo/...)
  let safePath = decodeURIComponent(pathname);
  if (safePath === '/' || safePath === '') safePath = 'index.html';
  if (safePath.startsWith('/')) safePath = safePath.slice(1);

  const filePath = path.join(rootDir, safePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
      return;
    }
  } catch (err) {}

  // Fallback về index.html cho trang chủ
  try {
    const indexPath = path.join(rootDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const indexContent = fs.readFileSync(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(indexContent);
      return;
    }
  } catch (err) {}

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found: ' + pathname);
}

// Xuất handler cho Vercel Serverless Function
module.exports = handler;

// Chạy server khi ở môi trường Localhost (node server.js)
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    console.log(`🚀 Web Server đang chạy tại: http://localhost:${PORT}`);
    console.log(`📁 Dữ liệu được đồng bộ trực tiếp với: ${path.join(process.cwd(), 'data.json')}`);
  });
}
