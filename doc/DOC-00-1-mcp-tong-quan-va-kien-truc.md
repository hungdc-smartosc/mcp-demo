# DOC-00-1: MCP — Tổng quan & Kiến trúc

> **Đối tượng:** Software Engineers, Backend Developers (Linux/Ubuntu)  
> **Phiên bản:** 1.0 — 2026-06-25  
> **Series:** Bộ tài liệu Model Context Protocol (MCP)

---

## Mục lục

1. [MCP là gì?](#1-mcp-là-gì)
2. [Kiến trúc tổng quan](#2-kiến-trúc-tổng-quan)
3. [Các loại MCP Server phổ biến](#3-các-loại-mcp-server-phổ-biến)
4. [Vòng đời một request MCP](#4-vòng-đời-một-request-mcp)

---

## 1. MCP là gì?

### 1.1 Định nghĩa

**Model Context Protocol (MCP)** là một giao thức mã nguồn mở do Anthropic phát triển và công bố vào tháng 11/2024. MCP chuẩn hóa cách thức một AI Model (như Claude, Gemini, GPT) giao tiếp với các công cụ và nguồn dữ liệu bên ngoài.

> **Tóm gọn:** MCP là "USB-C cho AI" — một cổng kết nối tiêu chuẩn giúp bất kỳ AI Agent nào cũng có thể gắn vào bất kỳ công cụ nào mà không cần viết lại tích hợp từ đầu.

### 1.2 Vấn đề MCP giải quyết

**Trước khi có MCP**, mỗi tích hợp AI phải được viết riêng:

```
Claude ──── custom code ────► Google Drive
Claude ──── custom code ────► PostgreSQL
Claude ──── custom code ────► GitHub
GPT-4  ──── custom code ────► Google Drive   ← Viết lại từ đầu!
GPT-4  ──── custom code ────► PostgreSQL      ← Viết lại từ đầu!
```

Hệ quả:
- **N model × M tool = N×M** đoạn code tích hợp khác nhau.
- Mỗi team viết theo cách riêng, không tái sử dụng được.
- Khi API thay đổi, phải sửa ở nhiều nơi.

**Sau khi có MCP**, chỉ cần viết MCP Server một lần:

```
Claude ──┐
GPT-4  ──┤── MCP Client ──► MCP Server (Google Drive) ──► Google Drive
Gemini ──┘                ► MCP Server (PostgreSQL)   ──► PostgreSQL
                          ► MCP Server (GitHub)       ──► GitHub
```

Hệ quả:
- **1 MCP Server** phục vụ **mọi AI Model**.
- Tái sử dụng hoàn toàn — viết một lần, dùng mãi mãi.
- Cộng đồng chia sẻ MCP Server qua npm, PyPI.

### 1.3 Lợi ích thực tế trong workflow phát triển phần mềm

| Tình huống | Không có MCP | Có MCP |
|---|---|---|
| AI đọc tài liệu dự án trên Google Drive | Copy-paste thủ công | AI tự đọc qua MCP |
| AI query database để phân tích dữ liệu | Xuất CSV rồi paste | AI query trực tiếp qua MCP |
| AI đọc log hệ thống để debug | Copy log rồi paste | AI tự đọc file log qua MCP |
| AI tạo và upload báo cáo | Làm thủ công | AI tự tạo và upload qua MCP |

---

## 2. Kiến trúc tổng quan

### 2.1 Sơ đồ thành phần

```
┌─────────────────────────────────────────────────────────────┐
│                        HOST APPLICATION                      │
│  (IDE như Antigravity, Claude Desktop, VS Code Copilot...)  │
│                                                             │
│   ┌─────────────┐      ┌─────────────┐                      │
│   │  AI Model   │◄────►│  MCP Client │                      │
│   │  (LLM)      │      │ (tích hợp   │                      │
│   └─────────────┘      │  trong Host)│                      │
│                        └──────┬──────┘                      │
└───────────────────────────────┼─────────────────────────────┘
                                │ MCP Protocol
                    ┌───────────┴───────────┐
                    │                       │
             ┌──────▼──────┐        ┌──────▼──────┐
             │ MCP Server  │        │ MCP Server  │
             │ (Google     │        │ (PostgreSQL)│
             │  Drive)     │        │             │
             └──────┬──────┘        └──────┬──────┘
                    │                       │
             ┌──────▼──────┐        ┌──────▼──────┐
             │  Google     │        │  Database   │
             │  Drive API  │        │  (Postgres) │
             └─────────────┘        └─────────────┘
```

### 2.2 Vai trò của từng thành phần

| Thành phần | Vai trò | Ví dụ cụ thể |
|---|---|---|
| **Host** | Ứng dụng chứa AI Agent và quản lý MCP Client | Antigravity IDE, Claude Desktop |
| **MCP Client** | Cầu nối giao tiếp giữa AI Model và MCP Server. Được tích hợp sẵn trong Host | Tích hợp trong Antigravity |
| **MCP Server** | Phần mềm nhỏ khai báo các Tool và xử lý yêu cầu từ Client | `mcp-demo/dist/index.js` |
| **Resource/Tool** | Hành động cụ thể mà Server cung cấp | `list_files`, `read_file`, `upload_file` |

### 2.3 Transport Layer: Stdio vs HTTP/SSE

MCP hỗ trợ 2 cơ chế truyền tải (Transport):

#### Stdio Transport (Phổ biến nhất — dùng cho local server)

```
Host ──── stdin/stdout ────► MCP Server Process (chạy trên máy local)
```

- MCP Server chạy như một **subprocess** của Host.
- Giao tiếp qua **stdin** (Host gửi) và **stdout** (Server trả về).
- Host tự khởi động và tắt Server khi cần.
- **Khi nào dùng:** Server chạy cùng máy với Host (local MCP server).

```json
// mcp_config.json — cấu hình Stdio Transport
{
  "mcpServers": {
    "my-server": {
      "command": "node",          // ← Lệnh khởi động server
      "args": ["dist/index.js"],  // ← Argument truyền vào
      "cwd": "/path/to/project"   // ← Working directory
    }
  }
}
```

#### HTTP/SSE Transport (Dành cho remote server)

```
Host ──── HTTP/SSE ────► MCP Server (chạy trên server từ xa)
```

- MCP Server chạy như một **HTTP server** độc lập.
- Giao tiếp qua **HTTP** (request) và **SSE** (Server-Sent Events cho streaming).
- **Khi nào dùng:** Server chạy trên cloud, container Docker, hoặc máy khác.

```json
// mcp_config.json — cấu hình HTTP/SSE Transport
{
  "mcpServers": {
    "remote-server": {
      "url": "https://my-mcp-server.example.com/mcp"
    }
  }
}
```

> **Ghi chú thực tế:** Hầu hết MCP Server trong môi trường phát triển dùng **Stdio Transport** vì đơn giản và không cần mở port mạng.

---

## 3. Các loại MCP Server phổ biến

### 3.1 Server có sẵn (npx packages)

Cộng đồng đã publish sẵn nhiều MCP Server lên npm. Chỉ cần cấu hình `mcp_config.json`, không cần viết code:

```json
{
  "mcpServers": {
    "gdrive": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-gdrive"],
      "env": { "GDRIVE_CREDENTIALS_JSON": "..." }
    },
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
               "postgresql://user:pass@localhost/mydb"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem",
               "/home/ubuntu/projects"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx" }
    }
  }
}
```

**Ưu điểm:** Nhanh, không cần code, cộng đồng maintain.  
**Nhược điểm:** Phụ thuộc package ngoài, ít linh hoạt tùy chỉnh.

### 3.2 Server tự xây dựng (Custom)

Viết MCP Server riêng bằng TypeScript/Python khi cần logic tùy chỉnh:

```
mcp-demo/
├── src/
│   ├── index.ts    ← Server chính (đăng ký tools, xử lý request)
│   ├── gdrive.ts   ← Logic kết nối Google Drive
│   └── auth.ts     ← Luồng xác thực OAuth2
├── dist/           ← Output sau khi build (Node.js chạy từ đây)
├── package.json
└── tsconfig.json
```

**Ưu điểm:** Toàn quyền kiểm soát, thêm business logic tùy ý.  
**Nhược điểm:** Cần viết code, build TypeScript, tự maintain.

### 3.3 Bảng so sánh: npx package vs Custom server

| Tiêu chí | npx package | Custom server |
|---|---|---|
| **Thời gian setup** | ~15 phút | ~2-4 giờ |
| **Yêu cầu kỹ năng** | Không cần code | TypeScript/Node.js |
| **Tùy chỉnh logic** | ❌ Không thể | ✅ Hoàn toàn |
| **Thêm business rule** | ❌ Không thể | ✅ Hoàn toàn |
| **Bảo mật credentials** | Nhúng vào config | Lưu file riêng biệt |
| **Phù hợp cho** | Dùng nhanh, POC | Production, dự án thực |
| **Ví dụ** | `@modelcontextprotocol/server-gdrive` | `mcp-demo` |

---

## 4. Vòng đời một request MCP

### 4.1 Luồng hoàn chỉnh từ AI Agent đến Resource

Ví dụ: AI Agent được yêu cầu *"Đọc file báo cáo trên Google Drive"*.

```
Bước 1: User yêu cầu AI
──────────────────────────────────────────────────────────────
  User → "Đọc nội dung file SOSC_HF-2026_HungDC trên Drive"

Bước 2: AI Model phân tích và quyết định dùng Tool
──────────────────────────────────────────────────────────────
  AI Model nhận ra cần dùng tool "read_file"
  AI Model gửi yêu cầu gọi tool đến MCP Client:
  {
    "tool": "read_file",
    "arguments": { "fileId": "1RQj7-YZLKh..." }
  }

Bước 3: MCP Client chuyển tiếp đến MCP Server
──────────────────────────────────────────────────────────────
  MCP Client serialize request → gửi qua stdin tới MCP Server process

  {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "read_file",
      "arguments": { "fileId": "1RQj7-YZLKh..." }
    }
  }

Bước 4: MCP Server xử lý và gọi Resource
──────────────────────────────────────────────────────────────
  MCP Server nhận request
  → Gọi Google Drive API (drive.files.get / drive.files.export)
  → Nhận nội dung file từ Google Drive

Bước 5: MCP Server trả kết quả về Client
──────────────────────────────────────────────────────────────
  {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "content": [
        {
          "type": "text",
          "text": "CHƯƠNG 1. TỔNG QUAN VỀ SMARTOSC..."
        }
      ]
    }
  }

Bước 6: AI Model nhận kết quả và tổng hợp
──────────────────────────────────────────────────────────────
  MCP Client chuyển kết quả về AI Model
  AI Model đọc nội dung → Phân tích → Trả lời User
```

### 4.2 Giao thức nền tảng: JSON-RPC 2.0

MCP sử dụng **JSON-RPC 2.0** — một giao thức nhẹ, chuẩn hóa cách gọi hàm từ xa qua JSON.

Cấu trúc một request:
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "tools/call",
  "params": {
    "name": "list_files",
    "arguments": {
      "folderId": "root",
      "maxResults": 20
    }
  }
}
```

Cấu trúc một response thành công:
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "result": {
    "content": [
      { "type": "text", "text": "[{\"id\": \"...\", \"name\": \"...\"}]" }
    ]
  }
}
```

Cấu trúc một response lỗi:
```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "error": {
    "code": -32603,
    "message": "Internal error: Google API quota exceeded"
  }
}
```

### 4.3 Initialization Handshake

Khi Host khởi động MCP Server, một quá trình bắt tay (handshake) diễn ra:

```
Host (Client)                          MCP Server
     │                                      │
     │── initialize ────────────────────────►│  Gửi thông tin version, capabilities
     │◄── initialized ─────────────────────│  Server xác nhận, gửi capabilities
     │── tools/list ───────────────────────►│  Hỏi: Server có những Tool gì?
     │◄── [list_files, read_file, ...] ────│  Server trả danh sách Tools + schema
     │  (Từ đây Host biết Server có gì)     │
     │── tools/call "list_files" ──────────►│  Gọi Tool cụ thể
     │◄── { content: [...] } ──────────────│  Nhận kết quả
```

> Đây là lý do khi bạn xem giao diện **Manage MCPs** trong Antigravity, nó hiển thị được danh sách 4 tools (`list_files`, `read_file`, `search_files`, `upload_file`) — Host đã thực hiện bước `tools/list` trong quá trình khởi động.

---

## Tóm tắt

| Khái niệm | Điểm cốt lõi |
|---|---|
| **MCP là gì?** | Giao thức chuẩn hóa kết nối AI Model với công cụ bên ngoài |
| **Vấn đề giải quyết** | Loại bỏ N×M tích hợp thủ công, thay bằng 1 chuẩn duy nhất |
| **Thành phần chính** | Host → MCP Client → MCP Server → Resource |
| **Transport** | Stdio (local) hoặc HTTP/SSE (remote) |
| **Giao thức nền** | JSON-RPC 2.0 qua stdin/stdout hoặc HTTP |
| **2 loại Server** | npx package (nhanh) hoặc Custom (linh hoạt) |

---

## Tài liệu tham khảo

- [MCP Official Documentation](https://modelcontextprotocol.io/docs)
- [MCP GitHub Repository](https://github.com/modelcontextprotocol)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Danh sách MCP Server cộng đồng](https://github.com/modelcontextprotocol/servers)

---

*Tiếp theo: [DOC-00-2 — Cấu hình mcp_config.json chi tiết](./DOC-00-2-mcp-client-server-va-cau-hinh.md)*
