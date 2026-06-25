# DOC-00-2: Cấu hình MCP Client-Server — mcp_config.json

> **Đối tượng:** Software Engineers, Backend Developers (Linux/Ubuntu)  
> **Phiên bản:** 1.0 — 2026-06-25  
> **Series:** Bộ tài liệu Model Context Protocol (MCP)

---

## Mục lục

1. [Cấu trúc file mcp_config.json](#1-cấu-trúc-file-mcp_configjson)
2. [Các kiểu command](#2-các-kiểu-command)
3. [Quản lý nhiều MCP Server](#3-quản-lý-nhiều-mcp-server)
4. [Bảo mật credentials trong config](#4-bảo-mật-credentials-trong-config)
5. [Debugging khi MCP Server không hoạt động](#5-debugging-khi-mcp-server-không-hoạt-động)

---

## 1. Cấu trúc file mcp_config.json

### 1.1 Vị trí file

`mcp_config.json` là file cấu hình **Global** — áp dụng cho toàn bộ workspace và project trong Antigravity:

```
~/.gemini/antigravity/mcp_config.json
```

> **Quan trọng:** File này KHÔNG nằm trong thư mục dự án, nên không bị ảnh hưởng khi bạn chuyển workspace hay mở project khác.

### 1.2 Cấu trúc JSON đầy đủ

```json
{
  "mcpServers": {
    "<tên-server>": {
      "command": "<lệnh-khởi-động>",
      "args": ["<arg-1>", "<arg-2>"],
      "env": {
        "BIEN_MOI_TRUONG": "gia-tri"
      },
      "cwd": "/đường/dẫn/thư/mục/làm/việc"
    }
  }
}
```

### 1.3 Giải thích chi tiết từng trường

| Trường | Bắt buộc | Kiểu | Mô tả |
|---|---|---|---|
| `command` | ✅ Có | `string` | Lệnh thực thi để khởi động MCP Server (`node`, `npx`, `python`, `uvx`...) |
| `args` | ⚪ Tùy chọn | `string[]` | Danh sách argument truyền vào lệnh `command` |
| `env` | ⚪ Tùy chọn | `object` | Biến môi trường (Environment Variables) chỉ áp dụng cho server này |
| `cwd` | ⚪ Tùy chọn | `string` | Working directory — thư mục gốc khi server khởi động |
| `url` | ⚪ Tùy chọn | `string` | Thay cho `command` nếu dùng HTTP/SSE Transport (remote server) |

### 1.4 Ví dụ cấu hình thực tế của dự án mcp-demo

```json
{
  "mcpServers": {
    "google-drive-mcp": {
      "command": "node",
      "args": [
        "/home/ubuntu/Data_D/SmartOSC/mcp-demo/dist/index.js"
      ],
      "cwd": "/home/ubuntu/Data_D/SmartOSC/mcp-demo"
    }
  }
}
```

Giải thích:
- `"command": "node"` → Dùng Node.js để chạy server.
- `"args": [".../dist/index.js"]` → File JavaScript đã compile từ TypeScript.
- `"cwd": "..."` → Server sẽ tìm file `credentials.json` và `token.json` từ thư mục này.

---

## 2. Các kiểu command

### 2.1 Dùng `npx` (Package có sẵn từ npm)

Cách phổ biến nhất để dùng MCP Server công khai mà không cần cài đặt trước:

```json
{
  "mcpServers": {
    "gdrive-public": {
      "command": "npx",
      "args": [
        "-y",                                      // Tự động xác nhận cài đặt
        "@modelcontextprotocol/server-gdrive"      // Tên package npm
      ],
      "env": {
        "GDRIVE_CREDENTIALS_JSON": "{...}"
      }
    }
  }
}
```

> **Flag `-y`:** Tự động trả lời "yes" cho prompt cài đặt của npx, tránh Server bị treo chờ input.

**Khi nào dùng `npx`:**
- Muốn thử nhanh một MCP Server có sẵn.
- Không muốn clone code về máy.
- Package được cộng đồng maintain tốt.

**Lưu ý:** Mỗi lần khởi động, `npx` sẽ kiểm tra và tải package mới nhất nếu chưa có cache. Có thể chậm lần đầu.

---

### 2.2 Dùng `node` (Compiled JavaScript — Custom Server)

Dành cho MCP Server tự viết bằng TypeScript, đã được compile ra JavaScript:

```json
{
  "mcpServers": {
    "my-custom-server": {
      "command": "node",
      "args": [
        "/absolute/path/to/dist/index.js"   // Đường dẫn tuyệt đối tới file JS
      ],
      "cwd": "/absolute/path/to/project"    // Working directory
    }
  }
}
```

> **Dùng đường dẫn tuyệt đối** thay vì đường dẫn tương đối để tránh lỗi khi Antigravity khởi động từ thư mục khác.

**Khi nào dùng `node`:**
- Đã tự viết MCP Server bằng TypeScript.
- Cần custom logic (xác thực phức tạp, kết nối internal service...).
- Cần kiểm soát hoàn toàn luồng xử lý.

---

### 2.3 Dùng `python` / `uvx` (MCP Server Python)

Dành cho MCP Server viết bằng Python:

```json
{
  "mcpServers": {
    "python-server": {
      "command": "python",
      "args": [
        "-m", "my_mcp_server"    // Chạy module Python
      ],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

Hoặc dùng `uvx` (tương tự `npx` nhưng cho Python):

```json
{
  "mcpServers": {
    "python-server-uvx": {
      "command": "uvx",
      "args": [
        "mcp-server-sqlite",                  // Package Python
        "--db-path", "/path/to/database.db"  // Argument cho package
      ]
    }
  }
}
```

---

### 2.4 Dùng `url` (Remote HTTP/SSE Server)

Dành cho MCP Server chạy từ xa (cloud, Docker container, máy chủ khác):

```json
{
  "mcpServers": {
    "remote-server": {
      "url": "https://mcp.mycompany.com/api/mcp",
      "env": {
        "AUTHORIZATION": "Bearer eyJhbGci..."   // Header xác thực
      }
    }
  }
}
```

---

## 3. Quản lý nhiều MCP Server

### 3.1 Cấu hình đồng thời nhiều server

Bạn có thể khai báo bất kỳ số lượng server nào trong một file `mcp_config.json`:

```json
{
  "mcpServers": {

    // Server 1: Google Drive (Custom, đã build)
    "google-drive-mcp": {
      "command": "node",
      "args": ["/home/ubuntu/mcp-demo/dist/index.js"],
      "cwd": "/home/ubuntu/mcp-demo"
    },

    // Server 2: PostgreSQL (Package có sẵn)
    "postgres-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://admin:secret@localhost:5432/mydb"
      ]
    },

    // Server 3: Filesystem (đọc/ghi file local)
    "filesystem-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/home/ubuntu/projects",        // Thư mục được phép truy cập
        "/home/ubuntu/documents"
      ]
    },

    // Server 4: GitHub
    "github-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxxxxxxxxxxx"
      }
    }

  }
}
```

> **Lưu ý về performance:** Mỗi MCP Server là một process riêng biệt. Khai báo nhiều server đồng nghĩa với nhiều process chạy song song trong nền. Chỉ khai báo những server thực sự cần dùng.

### 3.2 Bật/tắt từng server không cần xóa config

Để tạm thời vô hiệu hóa một server mà không xóa cấu hình, thêm tiền tố `_disabled_` vào tên server:

```json
{
  "mcpServers": {
    "google-drive-mcp": { ... },        // ← Đang bật
    "_disabled_postgres-mcp": { ... },  // ← Đã tắt (Antigravity bỏ qua)
    "filesystem-mcp": { ... }           // ← Đang bật
  }
}
```

Hoặc comment out trong JSON5 (nếu IDE hỗ trợ):

> **Lưu ý:** JSON tiêu chuẩn không hỗ trợ comment `//`. Antigravity có thể hỗ trợ JSON5. Kiểm tra tài liệu IDE của bạn.

---

## 4. Bảo mật credentials trong config

### 4.1 ❌ Cách KHÔNG nên làm — Nhúng thẳng vào JSON

```json
// NGUY HIỂM — Không làm theo cách này trong dự án thực tế
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "some-mcp-server"],
      "env": {
        "DATABASE_PASSWORD": "super_secret_password_123",   // ← Lộ mật khẩu!
        "API_SECRET_KEY": "sk-live-xxxxxxxxxxxxxxxxxxxx"    // ← Lộ API key!
      }
    }
  }
}
```

**Vấn đề:**
- File `mcp_config.json` có thể bị đọc bởi người khác nếu máy tính bị truy cập.
- Nếu vô tình commit file này lên Git, thông tin nhạy cảm sẽ bị lộ.

### 4.2 ✅ Cách 1 — Dùng biến môi trường hệ thống (Khuyến nghị)

Lưu credentials trong biến môi trường của hệ điều hành, không nhúng vào JSON:

**Bước 1:** Thêm vào `~/.bashrc` hoặc `~/.zshrc`:

```bash
# ~/.bashrc
export GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
export DB_PASSWORD="super_secret_password"
export GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxx"
```

**Bước 2:** Reload shell:

```bash
source ~/.bashrc
```

**Bước 3:** Tham chiếu trong `mcp_config.json` bằng cú pháp `${VAR_NAME}`:

```json
{
  "mcpServers": {
    "github-mcp": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

> **Kiểm tra:** Antigravity có hỗ trợ `${VAR}` syntax hay không tùy phiên bản. Xem tài liệu IDE để xác nhận.

### 4.3 ✅ Cách 2 — Lưu file riêng biệt ngoài thư mục dự án

Đây là cách dự án **mcp-demo** đang áp dụng:

```
Trong thư mục dự án:
  mcp-demo/
  ├── credentials.json    ← Chứa client_id, client_secret
  ├── token.json          ← Chứa access_token, refresh_token
  └── .gitignore          ← Bắt buộc phải có 2 file trên trong này!
```

**File `.gitignore` phải bao gồm:**

```gitignore
# .gitignore
credentials.json
token.json
dist/
node_modules/
.env
*.env
```

**Trong `mcp_config.json`:**

```json
{
  "mcpServers": {
    "google-drive-mcp": {
      "command": "node",
      "args": ["/home/ubuntu/mcp-demo/dist/index.js"],
      "cwd": "/home/ubuntu/mcp-demo"
      // Server tự đọc credentials.json và token.json từ cwd
    }
  }
}
```

MCP Server tự đọc file khi khởi động:

```typescript
// src/gdrive.ts
const TOKEN_PATH = path.join(process.cwd(), 'token.json');         // ← Đọc từ cwd
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json'); // ← Đọc từ cwd
```

### 4.4 ✅ Cách 3 — Dùng file `.env` kết hợp `dotenv`

```bash
# .env (không commit lên Git)
GOOGLE_CLIENT_ID=123456789-abcdefgh.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
DATABASE_URL=postgresql://user:pass@localhost:5432/mydb
```

Trong code MCP Server:

```typescript
// src/index.ts
import dotenv from 'dotenv';
dotenv.config(); // Tự động đọc file .env

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
```

### 4.5 Bảng tóm tắt các phương pháp bảo mật

| Phương pháp | Độ bảo mật | Độ tiện lợi | Phù hợp với |
|---|---|---|---|
| Nhúng thẳng vào JSON | ❌ Kém | ✅ Cao | Không nên dùng |
| Biến môi trường hệ thống | ✅ Tốt | ✅ Cao | Server dùng chung nhiều project |
| File riêng + .gitignore | ✅ Tốt | ✅ Trung bình | Custom server (như mcp-demo) |
| File .env + dotenv | ✅ Tốt | ✅ Cao | Project TypeScript/Node.js |

---

## 5. Debugging khi MCP Server không hoạt động

### 5.1 Triệu chứng thường gặp

| Triệu chứng | Nguyên nhân phổ biến |
|---|---|
| Server không xuất hiện trong Manage MCPs | Sai cú pháp JSON trong `mcp_config.json` |
| Server xuất hiện nhưng không có Tool | Server crash khi khởi động |
| Tool gọi được nhưng trả về lỗi | Thiếu credentials, token hết hạn |
| Server khởi động chậm | `npx` đang tải package lần đầu |

### 5.2 Kiểm tra JSON hợp lệ

```bash
# Kiểm tra cú pháp JSON của mcp_config.json
cat ~/.gemini/antigravity/mcp_config.json | python3 -m json.tool

# Nếu JSON hợp lệ, output sẽ là JSON được format đẹp
# Nếu lỗi, sẽ hiển thị dòng lỗi cụ thể
```

### 5.3 Chạy thủ công để xem lỗi

Thay vì để Antigravity khởi động MCP Server, chạy trực tiếp từ terminal để thấy error log:

```bash
# Với custom server (node)
cd /home/ubuntu/Data_D/SmartOSC/mcp-demo
node dist/index.js

# Kết quả mong đợi (server khởi động thành công):
# 🚀 Google Drive MCP Server is running...

# Kết quả nếu lỗi (ví dụ thiếu token):
# ⚠️ Khởi động server bị gián đoạn: Thiếu credentials.json hoặc token.json
```

```bash
# Với npx server
npx -y @modelcontextprotocol/server-gdrive

# Xem output để biết lỗi gì
```

### 5.4 Kiểm tra file credentials có tồn tại không

```bash
# Kiểm tra file credentials trong thư mục project
ls -la /home/ubuntu/Data_D/SmartOSC/mcp-demo/
# Phải thấy: credentials.json và token.json

# Xem nội dung token có hợp lệ không
cat /home/ubuntu/Data_D/SmartOSC/mcp-demo/token.json
# Phải có: access_token, refresh_token, expiry_date
```

### 5.5 Kiểm tra quyền truy cập file

```bash
# Kiểm tra quyền đọc file
ls -la ~/.gemini/antigravity/mcp_config.json
# Phải có quyền: -rw-r--r-- hoặc -rw-------

# Nếu không có quyền đọc
chmod 644 ~/.gemini/antigravity/mcp_config.json
```

### 5.6 Reload MCP Server sau khi sửa config

Sau khi chỉnh sửa `mcp_config.json` hoặc rebuild code TypeScript:

1. Mở giao diện **Manage MCPs** trong Antigravity.
2. Click nút **Refresh** ở góc trên phải.
3. Hoặc: Restart Antigravity IDE hoàn toàn.

---

## Tóm tắt nhanh

```
Muốn thêm MCP Server mới?
──────────────────────────
1. Mở: ~/.gemini/antigravity/mcp_config.json
2. Thêm entry vào "mcpServers"
3. Chọn command phù hợp:
   - Dùng package npm  → "command": "npx", "args": ["-y", "package-name"]
   - Dùng server tự viết → "command": "node", "args": ["path/to/dist/index.js"]
   - Dùng server Python → "command": "python", "args": ["-m", "module"]
   - Dùng server remote → "url": "https://..."
4. Reload MCP trong IDE
5. Kiểm tra Tools xuất hiện trong Manage MCPs

Credentials bị lộ?
────────────────────
- Đừng bao giờ commit credentials.json, token.json, .env lên Git
- Luôn thêm vào .gitignore ngay từ đầu dự án
- Dùng biến môi trường hệ thống hoặc file riêng biệt
```

---

*Trước đó: [DOC-00-1 — MCP Tổng quan & Kiến trúc](./DOC-00-1-mcp-tong-quan-va-kien-truc.md)*  
*Tiếp theo: [DOC-00-3 — Cài đặt Google Drive & Database MCP Server](./DOC-00-3-mcp-gdrive-database-setup.md)*
