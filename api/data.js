const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  // Bật CORS cho phép gọi API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const filePath = path.join(process.cwd(), 'data.json');

  // GET: Đọc dữ liệu giải đấu từ data.json
  if (req.method === 'GET') {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(200).send(data);
    } catch (e) {
      return res.status(500).json({ error: 'Không thể đọc data.json trên server' });
    }
  }

  // POST: Vercel Serverless có hệ thống file Read-only, dữ liệu client được lưu trong LocalStorage
  if (req.method === 'POST') {
    return res.status(200).json({ 
      success: true, 
      message: 'Dữ liệu được lưu an toàn vào LocalStorage của trình duyệt.' 
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
