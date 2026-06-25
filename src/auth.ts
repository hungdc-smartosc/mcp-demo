import { google } from 'googleapis';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { URL } from 'url';

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');
const REDIRECT_PORT = 3000;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

async function authenticate() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`❌ Không tìm thấy file: ${CREDENTIALS_PATH}`);
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_secret, client_id } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    REDIRECT_URI
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n🚀 Đang khởi động local server để bắt OAuth2 callback...');
  console.log('\n🔗 Mở URL này trong trình duyệt:\n');
  console.log(authUrl);
  console.log('\n⏳ Đang chờ bạn xác thực...\n');

  // Khởi động local HTTP server để tự động nhận redirect
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;

      const urlObj = new URL(req.url, REDIRECT_URI);
      const code = urlObj.searchParams.get('code');
      const error = urlObj.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h2>❌ Xác thực thất bại: ${error}</h2><p>Vui lòng thử lại.</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h2>✅ Xác thực thành công!</h2>
              <p>Bạn có thể đóng tab này và quay lại terminal.</p>
            </body>
          </html>
        `);
        server.close();
        resolve(code);
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`🌐 Server đang lắng nghe tại http://localhost:${REDIRECT_PORT}`);
    });

    server.on('error', (err) => {
      reject(new Error(`Không thể khởi động server: ${err.message}. Hãy kiểm tra port ${REDIRECT_PORT} có bị chiếm không.`));
    });

    // Timeout sau 3 phút
    setTimeout(() => {
      server.close();
      reject(new Error('⏰ Timeout! Đã quá 3 phút mà chưa xác thực.'));
    }, 3 * 60 * 1000);
  });

  console.log('🔑 Đã nhận được authorization code, đang lấy token...');

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

  console.log('✅ Xác thực thành công! Đã lưu token vào token.json');
  console.log('🎉 Bạn có thể chạy "npm run build" để tiếp tục.\n');
}

authenticate().catch((err) => {
  console.error('\n❌ Lỗi xác thực:', err.message);
  process.exit(1);
});
