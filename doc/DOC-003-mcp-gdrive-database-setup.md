# DOC-003: Cài đặt Google Drive & Database MCP Server

> **Đối tượng:** Software Engineers, Backend Developers (Linux/Ubuntu)  
> **Phiên bản:** 1.0 — 2026-06-25  
> **Series:** Bộ tài liệu Model Context Protocol (MCP)

---

## Mục lục

1. [Google Drive MCP Server — Cách 1: npx Package](#1-google-drive-mcp-server--cách-1-npx-package)
2. [Google Drive MCP Server — Cách 2: Custom TypeScript Server](#2-google-drive-mcp-server--cách-2-custom-typescript-server)
3. [Bảng so sánh 2 cách & khi nào dùng cái nào](#3-bảng-so-sánh-2-cách--khi-nào-dùng-cái-nào)
4. [Database MCP Server — PostgreSQL](#4-database-mcp-server--postgresql)
5. [Kiểm tra MCP Server hoạt động](#5-kiểm-tra-mcp-server-hoạt-động)

---

## 1. Google Drive MCP Server — Cách 1: npx Package

### Tổng quan luồng cài đặt

```
Bước 1: Tạo Google Cloud Project
    ↓
Bước 2: Tạo OAuth2 Credentials (client_id, client_secret)
    ↓
Bước 3: Cấu hình mcp_config.json
    ↓
Bước 4: Xác thực OAuth lần đầu (mở trình duyệt)
    ↓
✅ Hoàn tất
```

### Bước 1: Tạo Google Cloud Project

1. Truy cập [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** → **"NEW PROJECT"**
3. Điền tên project (ví dụ: `my-mcp-gdrive`)
4. Click **"CREATE"**

### Bước 2: Bật Google Drive API

1. Trong Cloud Console, vào **"APIs & Services"** → **"Library"**
2. Tìm kiếm **"Google Drive API"**
3. Click vào kết quả → Click **"ENABLE"**

### Bước 3: Tạo OAuth2 Credentials

1. Vào **"APIs & Services"** → **"Credentials"**
2. Click **"+ CREATE CREDENTIALS"** → **"OAuth client ID"**
3. Nếu chưa có OAuth consent screen, làm theo hướng dẫn:
   - User Type: **External**
   - App name: `My MCP App`
   - User support email: `<email của bạn>`
   - Click **"SAVE AND CONTINUE"** qua các bước
4. Quay lại tạo OAuth client ID:
   - Application type: **Desktop app**
   - Name: `MCP Desktop Client`
   - Click **"CREATE"**
5. **Download JSON** → Lưu file này

### Bước 4: Cấu hình mcp_config.json (Cách npx)

Lấy nội dung từ file JSON vừa download, điền vào config:

```json
{
  "mcpServers": {
    "google-workspace": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-gdrive"
      ],
      "env": {
        "GDRIVE_CREDENTIALS_JSON": {
          "installed": {
            "client_id": "123456789-abcdefgh.apps.googleusercontent.com",
            "project_id": "my-mcp-gdrive",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": "GOCSPX-xxxxxxxxxxxxxxxxxxxx",
            "redirect_uris": ["http://localhost"]
          }
        }
      }
    }
  }
}
```

> **Ghi chú:** `GDRIVE_CREDENTIALS_JSON` nhận giá trị là một **JSON object** (không phải string). Một số phiên bản server có thể yêu cầu stringify thành string — tham khảo README của package.

### Bước 5: Xác thực OAuth lần đầu

Lần đầu chạy, package sẽ tự mở trình duyệt để đăng nhập Google:

```bash
# Chạy thủ công để xem luồng xác thực
npx -y @modelcontextprotocol/server-gdrive
# → Trình duyệt mở → Đăng nhập Google → Cấp quyền → Token được lưu
```

Sau khi xác thực xong, token sẽ được lưu tự động (thường trong `~/.config/` hoặc thư mục tạm).

---

## 2. Google Drive MCP Server — Cách 2: Custom TypeScript Server

### Tổng quan luồng cài đặt

```
Bước 1: Tạo Google Cloud Project + Credentials (giống Cách 1)
    ↓
Bước 2: Clone / Tạo project TypeScript
    ↓
Bước 3: Lưu credentials.json vào thư mục project
    ↓
Bước 4: Chạy npm run auth → Sinh ra token.json
    ↓
Bước 5: Chạy npm run build → Sinh ra dist/
    ↓
Bước 6: Cấu hình mcp_config.json
    ↓
✅ Hoàn tất
```

### Bước 1: Khởi tạo project TypeScript

```bash
# Tạo thư mục project
mkdir mcp-gdrive-custom
cd mcp-gdrive-custom

# Khởi tạo Node.js project
npm init -y

# Cài đặt dependencies
npm install @modelcontextprotocol/sdk googleapis google-auth-library

# Cài đặt dev dependencies
npm install -D typescript @types/node tsx

# Khởi tạo tsconfig.json
npx tsc --init
```

Cập nhật `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Cập nhật `package.json`:

```json
{
  "name": "mcp-gdrive-custom",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts",
    "auth": "tsx src/auth.ts"
  }
}
```

### Bước 2: Lưu credentials.json

Download file credentials từ Google Cloud Console (xem Cách 1, Bước 3), lưu vào thư mục project:

```bash
# Lưu file vào root của project
cp ~/Downloads/client_secret_xxxx.json ./credentials.json

# Kiểm tra nội dung
cat credentials.json
```

Nội dung `credentials.json` có dạng:

```json
{
  "installed": {
    "client_id": "123456789-abcdefgh.apps.googleusercontent.com",
    "project_id": "my-mcp-gdrive",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "GOCSPX-xxxxxxxxxxxxxxxxxxxx",
    "redirect_uris": ["http://localhost"]
  }
}
```

### Bước 3: Viết auth.ts — Luồng xác thực OAuth2

```typescript
// src/auth.ts
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
  // Đọc credentials từ file
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_secret, client_id } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);

  // Tạo URL đăng nhập Google
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',   // Lấy refresh_token để tự động làm mới
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('🔗 Mở URL này trong trình duyệt:\n', authUrl);

  // Khởi động HTTP server để nhận OAuth callback
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlObj = new URL(req.url!, REDIRECT_URI);
      const code = urlObj.searchParams.get('code');
      if (code) {
        res.end('<h2>✅ Xác thực thành công! Đóng tab này.</h2>');
        server.close();
        resolve(code);
      }
    });
    server.listen(REDIRECT_PORT);
    setTimeout(() => reject(new Error('Timeout sau 3 phút')), 3 * 60 * 1000);
  });

  // Đổi authorization code lấy token
  const { tokens } = await oAuth2Client.getToken(code);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log('✅ Đã lưu token vào token.json');
}

authenticate().catch(console.error);
```

### Bước 4: Chạy xác thực OAuth

```bash
npm run auth
# → Terminal hiển thị URL
# → Mở URL trong trình duyệt
# → Đăng nhập Google → Cấp quyền
# → Server tự nhận callback
# → Lưu token.json
```

Sau khi chạy xong, kiểm tra file `token.json`:

```bash
cat token.json
# Output mong đợi:
# {
#   "access_token": "ya29.xxxxx",
#   "refresh_token": "1//xxxxx",
#   "expiry_date": 1234567890000,
#   "token_type": "Bearer"
# }
```

### Bước 5: Viết gdrive.ts — Kết nối Google Drive

```typescript
// src/gdrive.ts
import { google, drive_v3 } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

export function createDriveClient(): drive_v3.Drive {
  if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) {
    throw new Error('Thiếu credentials.json hoặc token.json. Chạy npm run auth trước.');
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed;

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  oAuth2Client.setCredentials(token);

  // Tự động lưu token mới khi refresh
  oAuth2Client.on('tokens', (newTokens) => {
    const current = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...current, ...newTokens }, null, 2));
    console.error('🔄 Token đã được làm mới tự động.');
  });

  return google.drive({ version: 'v3', auth: oAuth2Client });
}
```

### Bước 6: Viết index.ts — MCP Server chính

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createDriveClient } from './gdrive.js';

const server = new Server(
  { name: 'google-drive-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Khởi tạo Drive client
let drive: any;
try {
  drive = createDriveClient();
} catch (err: any) {
  console.error(`⚠️ ${err.message}`);
}

// Khai báo danh sách Tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'list_files',
      description: 'Liệt kê files/folders trong Google Drive',
      inputSchema: {
        type: 'object',
        properties: {
          folderId: { type: 'string', description: 'ID folder (mặc định: root)' },
          maxResults: { type: 'number', description: 'Số kết quả tối đa (mặc định: 20)' },
        },
      },
    },
    {
      name: 'read_file',
      description: 'Đọc nội dung file text hoặc Google Doc',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'ID của file' },
        },
        required: ['fileId'],
      },
    },
    {
      name: 'search_files',
      description: 'Tìm kiếm files theo tên',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Từ khóa tìm kiếm' },
        },
        required: ['query'],
      },
    },
    {
      name: 'upload_file',
      description: 'Tạo và upload file text mới lên Google Drive',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Tên file' },
          content: { type: 'string', description: 'Nội dung file' },
          folderId: { type: 'string', description: 'ID folder lưu (tùy chọn)' },
        },
        required: ['name', 'content'],
      },
    },
  ],
}));

// Xử lý Tool call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!drive) {
    return { content: [{ type: 'text', text: '❌ Chưa xác thực. Chạy npm run auth.' }], isError: true };
  }

  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'list_files': {
        const folderId = (args?.folderId as string) || 'root';
        const maxResults = (args?.maxResults as number) || 20;
        const response = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          pageSize: maxResults,
          fields: 'files(id, name, mimeType, size, modifiedTime)',
        });
        return { content: [{ type: 'text', text: JSON.stringify(response.data.files, null, 2) }] };
      }

      case 'read_file': {
        const fileId = args?.fileId as string;
        const meta = await drive.files.get({ fileId, fields: 'mimeType, name' });
        const mimeType = meta.data.mimeType || '';
        let content: string;
        if (mimeType.includes('google-apps.document')) {
          const res = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' });
          content = res.data as string;
        } else {
          const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
          content = res.data as string;
        }
        return { content: [{ type: 'text', text: content }] };
      }

      case 'search_files': {
        const query = args?.query as string;
        const response = await drive.files.list({
          q: `name contains '${query}' and trashed = false`,
          pageSize: 20,
          fields: 'files(id, name, mimeType, modifiedTime)',
        });
        return { content: [{ type: 'text', text: JSON.stringify(response.data.files, null, 2) }] };
      }

      case 'upload_file': {
        const { name: filename, content: fileContent, folderId } = args as any;
        const fileMetadata: any = { name: filename };
        if (folderId) fileMetadata.parents = [folderId];
        const response = await drive.files.create({
          requestBody: fileMetadata,
          media: { mimeType: 'text/plain', body: fileContent },
          fields: 'id, name, webViewLink',
        });
        return {
          content: [{
            type: 'text',
            text: `✅ Upload thành công!\nTên: ${response.data.name}\nID: ${response.data.id}\nLink: ${response.data.webViewLink}`,
          }],
        };
      }

      default:
        throw new Error(`Tool không tồn tại: ${name}`);
    }
  } catch (error: any) {
    return { content: [{ type: 'text', text: `❌ Lỗi: ${error.message}` }], isError: true };
  }
});

// Khởi động server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 Google Drive MCP Server is running...');
}
main().catch(console.error);
```

### Bước 7: Build và cấu hình

```bash
# Build TypeScript → JavaScript
npm run build

# Kiểm tra dist/ đã được tạo
ls dist/
# Output: gdrive.js  index.js  auth.js

# Thêm vào .gitignore
echo "credentials.json" >> .gitignore
echo "token.json" >> .gitignore
echo "dist/" >> .gitignore
echo "node_modules/" >> .gitignore
```

Cấu hình `mcp_config.json`:

```json
{
  "mcpServers": {
    "google-drive-mcp": {
      "command": "node",
      "args": ["/home/ubuntu/mcp-gdrive-custom/dist/index.js"],
      "cwd": "/home/ubuntu/mcp-gdrive-custom"
    }
  }
}
```

---

## 3. Bảng so sánh 2 cách & khi nào dùng cái nào

| Tiêu chí | Cách 1: npx Package | Cách 2: Custom TypeScript |
|---|---|---|
| **Thời gian setup** | 15-30 phút | 2-4 giờ |
| **Cần viết code** | ❌ Không | ✅ Có |
| **Cần build TypeScript** | ❌ Không | ✅ Có (`npm run build`) |
| **Tùy chỉnh Tools** | ❌ Không | ✅ Hoàn toàn |
| **Thêm business logic** | ❌ Không | ✅ Hoàn toàn |
| **Kiểm soát error handling** | ❌ Không | ✅ Hoàn toàn |
| **Bảo mật credentials** | Nhúng vào JSON config | File riêng + .gitignore |
| **Phù hợp với** | Demo, POC, dùng nhanh | Production, dự án thực tế |
| **Khi token hết hạn** | Tự xử lý (tùy package) | Tự implement refresh logic |

**Khuyến nghị:**
- Dùng **Cách 1** nếu: Muốn thử nhanh MCP, không có yêu cầu tùy chỉnh.
- Dùng **Cách 2** nếu: Dự án production, cần thêm tools riêng, cần business logic phức tạp.

---

## 4. Database MCP Server — PostgreSQL

### 4.1 Cài đặt nhanh với npx

```bash
# Không cần cài đặt gì, npx tự tải về khi cần
```

Cấu hình `mcp_config.json`:

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://username:password@localhost:5432/database_name"
      ]
    }
  }
}
```

**Thay thế các giá trị:**

| Placeholder | Giá trị thực tế |
|---|---|
| `username` | User PostgreSQL (ví dụ: `postgres`, `admin`) |
| `password` | Mật khẩu database |
| `localhost` | Host database (`localhost` hoặc IP server) |
| `5432` | Port PostgreSQL (mặc định `5432`) |
| `database_name` | Tên database cụ thể |

### 4.2 Ví dụ thực tế với MedusaJS

Nếu đang chạy MedusaJS với PostgreSQL local:

```json
{
  "mcpServers": {
    "medusa-db": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://postgres:postgres@localhost:5432/medusa_db"
      ]
    }
  }
}
```

Sau khi cấu hình, AI có thể:
- Query trực tiếp database MedusaJS.
- Đọc thông tin sản phẩm, đơn hàng, khách hàng.
- Phân tích dữ liệu và viết báo cáo.

### 4.3 Bảo mật connection string

**Không nên:**
```json
"args": ["postgresql://admin:secret123@prod-server.com/mydb"]
```

**Nên dùng biến môi trường:**

```bash
# ~/.bashrc
export DB_CONNECTION="postgresql://admin:secret123@prod-server.com/mydb"
```

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DB_CONNECTION}"
      }
    }
  }
}
```

### 4.4 MySQL / MariaDB

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-server-mysql",
        "--host", "localhost",
        "--port", "3306",
        "--user", "root",
        "--password", "secret",
        "--database", "myapp"
      ]
    }
  }
}
```

### 4.5 SQLite (File database)

```json
{
  "mcpServers": {
    "sqlite-mcp": {
      "command": "uvx",
      "args": [
        "mcp-server-sqlite",
        "--db-path", "/home/ubuntu/projects/myapp/database.db"
      ]
    }
  }
}
```

> **Lưu ý:** `uvx` yêu cầu cài đặt Python và `uv` package manager trên hệ thống.

---

## 5. Kiểm tra MCP Server hoạt động

### 5.1 Kiểm tra qua giao diện Manage MCPs

1. Mở Antigravity IDE.
2. Click **"Open Agent Manager"** (hoặc phím tắt tương ứng).
3. Chọn tab **"Manage MCPs"**.
4. Xác nhận:
   - ✅ Server xuất hiện trong danh sách
   - ✅ Status là **Enabled**
   - ✅ Các Tools hiển thị đầy đủ

### 5.2 Test Tool trực tiếp qua chat

Sau khi cấu hình xong, thử ngay trong chat với AI:

**Test Google Drive:**
```
Liệt kê tất cả files trong Google Drive của tôi
```
```
Tìm kiếm file có tên "báo cáo" trong Google Drive
```
```
Đọc nội dung file [tên file] trong Google Drive
```

**Test PostgreSQL:**
```
Liệt kê tất cả bảng trong database
```
```
Cho tôi biết có bao nhiêu sản phẩm trong bảng product
```

### 5.3 Test thủ công bằng CLI (Nâng cao)

Có thể giao tiếp trực tiếp với MCP Server qua stdin/stdout:

```bash
# Khởi động server trong terminal
node /home/ubuntu/mcp-gdrive-custom/dist/index.js

# Mở terminal thứ 2, gửi request JSON-RPC
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js

# Kết quả mong đợi:
# {"jsonrpc":"2.0","id":1,"result":{"tools":[{"name":"list_files",...}]}}
```

### 5.4 Kiểm tra log lỗi

MCP Server ghi log vào **stderr** (không phải stdout — stdout dành cho JSON-RPC):

```bash
# Chạy server và tách stderr ra file log riêng
node dist/index.js 2> server.log

# Xem log trong thời gian thực
tail -f server.log
```

---

## Tóm tắt nhanh

```
Cài đặt Google Drive MCP:
────────────────────────────────────────────────────
1. Google Cloud Console → Bật Drive API → Tạo OAuth2 Credentials
2. Download credentials.json
3a. [Cách npx] → Điền vào mcp_config.json → Chạy npx lần đầu để xác thực
3b. [Cách custom] → Lưu credentials.json → npm run auth → npm run build
4. Cấu hình mcp_config.json
5. Reload MCP trong IDE → Kiểm tra Tools xuất hiện

Cài đặt PostgreSQL MCP:
────────────────────────────────────────────────────
1. Có sẵn database PostgreSQL đang chạy
2. Thêm vào mcp_config.json với connection string
3. Reload MCP trong IDE → Kiểm tra Tools
```

---

*Trước đó: [DOC-002 — Cấu hình mcp_config.json](./DOC-002-mcp-client-server-va-cau-hinh.md)*  
*Tiếp theo: [DOC-004 — Xây dựng Custom MCP Server](./DOC-004-mcp-xay-dung-custom-server.md)*
