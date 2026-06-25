# DOC-005: Tích hợp MCP vào Workflow tự động

> **Đối tượng:** Software Engineers, Backend Developers (Linux/Ubuntu)  
> **Phiên bản:** 1.0 — 2026-06-25  
> **Series:** Bộ tài liệu Model Context Protocol (MCP)

---

## Mục lục

1. [Tư duy thiết kế MCP Workflow](#1-tư-duy-thiết-kế-mcp-workflow)
2. [Các Workflow thực tế](#2-các-workflow-thực-tế)
3. [Kết hợp nhiều MCP Server](#3-kết-hợp-nhiều-mcp-server)
4. [Giới hạn & Rủi ro cần chú ý](#4-giới-hạn--rủi-ro-cần-chú-ý)
5. [Lộ trình phát triển tiếp theo](#5-lộ-trình-phát-triển-tiếp-theo)

---

## 1. Tư duy thiết kế MCP Workflow

### 1.1 AI Agent + MCP = Autonomous Developer Assistant

Không có MCP, AI chỉ là một chatbot thông minh — biết nhiều nhưng không làm được gì trong hệ thống thực.

Với MCP, AI trở thành một **Autonomous Agent** có thể:

```
Không có MCP:
  User → [Copy data] → AI → [Đọc] → [Trả lời] → User copy-paste kết quả thủ công

Có MCP:
  User → AI → [Tự đọc Google Drive] → [Tự query DB] → [Tự tạo file báo cáo] → User nhận kết quả
```

### 1.2 Nguyên tắc thiết kế Tool tốt

| Nguyên tắc | Mô tả | Ví dụ |
|---|---|---|
| **Đơn nhiệm** | Mỗi Tool chỉ làm 1 việc | `read_file` chỉ đọc, không sửa |
| **Idempotent** | Gọi nhiều lần cho kết quả giống nhau | `list_files` không thay đổi state |
| **Mô tả rõ ràng** | Description giúp AI quyết định dùng Tool nào | "Đọc nội dung một Google Doc" |
| **Validate input** | Kiểm tra đầu vào trước khi xử lý | `if (!fileId) throw Error(...)` |
| **Fail safe** | Lỗi phải rõ ràng, không làm hỏng dữ liệu | Return `isError: true` thay vì crash |

### 1.3 Quy tắc vàng: Không để AI làm điều không thể undo

```
✅ AI có thể làm:      Đọc file, query DB, tạo file mới, upload tài liệu
⚠️ Cần xác nhận:      Cập nhật dữ liệu, gửi email, tạo PR
❌ Không nên để AI tự làm: Xóa database, xóa file production, deploy lên prod
```

---

## 2. Các Workflow thực tế

### Workflow 1: Đọc tài liệu → Phân tích → Viết báo cáo → Upload

**Kịch bản:** Team lead muốn AI tổng hợp tài liệu training từ Google Drive thành báo cáo.

```
User: "Đọc tất cả file trong folder Training, tổng hợp thành báo cáo và upload lên Drive"

AI thực hiện:
  Bước 1: [list_files] → Lấy danh sách file trong folder
  Bước 2: [read_file] × N → Đọc từng file
  Bước 3: (Tự phân tích, tổng hợp nội dung)
  Bước 4: [upload_file] → Upload báo cáo lên Google Drive

User nhận: Link file báo cáo đã được tạo trên Drive
```

**MCP Server cần:** Google Drive MCP (đã có `list_files`, `read_file`, `upload_file`)

---

### Workflow 2: AI phân tích log → Tìm lỗi → Gợi ý fix

**Kịch bản:** Developer muốn AI phân tích log server để tìm nguyên nhân lỗi 500.

```
User: "Đọc log của service treasury-service trong 1 giờ qua, tìm nguyên nhân lỗi 500"

AI thực hiện:
  Bước 1: [read_local_file] → Đọc file log
  Bước 2: (Phân tích pattern lỗi, stack trace)
  Bước 3: (Gợi ý nguyên nhân + hướng fix)
  Bước 4: [write_local_file] → Ghi báo cáo debug vào file markdown

User nhận: Báo cáo phân tích với nguyên nhân và giải pháp cụ thể
```

**MCP Server cần:** Filesystem MCP (read/write file local)

```json
{
  "mcpServers": {
    "filesystem-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/var/log/services",
        "/home/ubuntu/projects"
      ]
    }
  }
}
```

---

### Workflow 3: AI đọc database → Viết báo cáo → Upload Drive

**Kịch bản:** Mỗi tháng cần báo cáo doanh thu từ database MedusaJS.

```
User: "Lấy dữ liệu đơn hàng tháng này từ database, phân tích và tạo báo cáo doanh thu"

AI thực hiện:
  Bước 1: [query_database] → SELECT dữ liệu orders tháng hiện tại
  Bước 2: (Tính toán: tổng doanh thu, sản phẩm bán chạy, tỷ lệ hoàn tiền...)
  Bước 3: [upload_file] → Upload báo cáo markdown lên Google Drive

User nhận: Link báo cáo chi tiết trên Drive
```

**MCP Server cần:** PostgreSQL MCP + Google Drive MCP

```json
{
  "mcpServers": {
    "medusa-db": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres",
               "postgresql://postgres:postgres@localhost:5432/medusa_db"]
    },
    "google-drive-mcp": {
      "command": "node",
      "args": ["/home/ubuntu/mcp-gdrive/dist/index.js"],
      "cwd": "/home/ubuntu/mcp-gdrive"
    }
  }
}
```

---

### Workflow 4: AI review code → Phân tích chất lượng → Tạo checklist

**Kịch bản:** Trước khi tạo Pull Request, AI review code và tạo checklist.

```
User: "Review code trong thư mục src/modules/brand, tạo checklist review"

AI thực hiện:
  Bước 1: [list_local_files] → Liệt kê file trong src/modules/brand/
  Bước 2: [read_local_file] × N → Đọc từng file TypeScript
  Bước 3: (Phân tích: code smell, missing tests, security issues, best practices)
  Bước 4: [write_local_file] → Ghi checklist vào REVIEW_CHECKLIST.md

User nhận: File checklist với nhận xét chi tiết từng vấn đề
```

---

## 3. Kết hợp nhiều MCP Server

### 3.1 Chain nhiều Server trong một tác vụ

AI có thể tự nhiên kết hợp Tools từ nhiều MCP Server khác nhau trong một cuộc hội thoại:

```
Câu hỏi của User:
"Đọc tài liệu kỹ thuật trên Drive, so sánh với code hiện tại trong dự án,
 rồi query database xem có data nào chưa khớp với spec không"

AI tự lên kế hoạch:
  1. [Google Drive MCP] → read_file (tài liệu kỹ thuật)
  2. [Filesystem MCP]   → read_local_file × N (source code)
  3. [PostgreSQL MCP]   → query (kiểm tra data trong DB)
  4. (Phân tích, so sánh)
  5. [Google Drive MCP] → upload_file (báo cáo kết quả)
```

### 3.2 Cấu hình đầy đủ cho dự án SmartOSC Banking

```json
{
  "mcpServers": {
    "google-drive-mcp": {
      "command": "node",
      "args": ["/home/ubuntu/mcp-gdrive/dist/index.js"],
      "cwd": "/home/ubuntu/mcp-gdrive"
    },
    "project-filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/home/ubuntu/Data_D/SmartOSC"
      ]
    },
    "banking-db": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-postgres",
        "postgresql://dev:dev123@localhost:5432/banking_dev"
      ]
    }
  }
}
```

### 3.3 Nguyên tắc khi kết hợp nhiều Server

```
✅ Đặt tên server rõ ràng, mô tả chức năng
   → "google-drive-mcp", "banking-db" thay vì "server1", "server2"

✅ Giới hạn quyền truy cập filesystem đến thư mục cụ thể
   → Chỉ cho phép /home/ubuntu/Data_D/SmartOSC, không phải toàn bộ /

✅ Dùng database dev/staging, không phải production
   → Khi AI query nhầm bảng, chỉ ảnh hưởng môi trường dev

✅ Không khai báo server không dùng
   → Mỗi server là 1 process, tốn tài nguyên khi idle
```

---

## 4. Giới hạn & Rủi ro cần chú ý

### 4.1 AI Agent không phải làm được mọi thứ

| Giới hạn | Lý do | Giải pháp |
|---|---|---|
| Context window có hạn | File quá lớn AI không đọc hết một lần | Chia nhỏ file, đọc theo phần |
| Không có memory giữa các session | Mỗi conversation là mới hoàn toàn | Lưu kết quả trung gian vào file |
| Không thể chạy song song | AI xử lý tuần tự, không multi-thread | Thiết kế workflow tuyến tính |
| Có thể bịa thông tin | AI hallucinate khi không chắc chắn | Luôn verify kết quả từ Tool |

### 4.2 Kiểm soát quyền hạn (Scoping Permissions)

**Nguyên tắc Least Privilege — chỉ cấp quyền tối thiểu cần thiết:**

```typescript
// ❌ Không nên: Cấp quyền toàn bộ hệ thống
const ALLOWED_DIR = '/';  // Toàn bộ filesystem!

// ✅ Nên: Giới hạn đến thư mục cụ thể
const ALLOWED_DIR = '/home/ubuntu/Data_D/SmartOSC/mcp-demo/docs';

// ❌ Không nên: Google Drive scope quá rộng
const SCOPES = ['https://www.googleapis.com/auth/drive'];  // Full access

// ✅ Nên: Chỉ cấp quyền đọc nếu không cần ghi
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
```

### 4.3 Audit Log — Theo dõi AI đã làm gì

Thêm audit log vào MCP Server để biết AI đã gọi Tool nào, khi nào, với tham số gì:

```typescript
// src/utils/audit.ts
import * as fs from 'fs';
import * as path from 'path';

const AUDIT_LOG_PATH = path.join(process.cwd(), 'audit.log');

export function auditLog(toolName: string, args: any, result: 'success' | 'error') {
  const entry = {
    timestamp: new Date().toISOString(),
    tool: toolName,
    args: args,
    result: result,
  };
  fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n');
}
```

Sử dụng trong handler:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTool(name, args);
    auditLog(name, args, 'success');  // ← Ghi log thành công
    return result;
  } catch (error: any) {
    auditLog(name, args, 'error');    // ← Ghi log thất bại
    return { content: [{ type: 'text', text: `❌ ${error.message}` }], isError: true };
  }
});
```

---

## 5. Lộ trình phát triển tiếp theo

### 5.1 Từ MCP đơn lẻ → Multi-Agent System

```
Giai đoạn 1 (Hiện tại):
  1 AI Agent + N MCP Servers → Thực hiện tác vụ theo yêu cầu người dùng

Giai đoạn 2 (Nâng cao):
  AI Orchestrator → phân công cho nhiều Sub-Agent
  ├── Sub-Agent 1 (chuyên đọc tài liệu) → Google Drive MCP
  ├── Sub-Agent 2 (chuyên phân tích data) → Database MCP
  └── Sub-Agent 3 (chuyên viết code) → Filesystem MCP

Giai đoạn 3 (Tự động hoàn toàn):
  Trigger (cron, webhook, event) → AI Agent Pipeline → Output
  Ví dụ: Mỗi ngày 8h sáng, AI tự tổng hợp báo cáo và gửi email
```

### 5.2 Tích hợp MCP vào CI/CD Pipeline

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review
on: [pull_request]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run MCP-powered AI Review
        run: |
          # Chạy MCP Server + AI Agent để review code
          node scripts/ai-review.js
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 5.3 Tài liệu tham khảo & Cộng đồng

| Nguồn | Link | Nội dung |
|---|---|---|
| Official Docs | [modelcontextprotocol.io](https://modelcontextprotocol.io) | Spec, API reference |
| TypeScript SDK | [github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | SDK source + examples |
| Server Registry | [github.com/modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | Danh sách server có sẵn |
| Python SDK | [github.com/modelcontextprotocol/python-sdk](https://github.com/modelcontextprotocol/python-sdk) | SDK cho Python |
| Community | [Discord MCP](https://discord.gg/anthropic) | Hỏi đáp, chia sẻ |

---

## Tổng kết toàn bộ Series

| File | Nội dung | Trạng thái |
|---|---|---|
| `DOC-001` | MCP là gì, kiến trúc, JSON-RPC | ✅ Hoàn thành |
| `DOC-002` | mcp_config.json chi tiết, bảo mật | ✅ Hoàn thành |
| `DOC-003` | Setup Google Drive + Database MCP | ✅ Hoàn thành |
| `DOC-004` | Xây dựng Custom MCP Server | ✅ Hoàn thành |
| `DOC-005` | Workflow tự động, Multi-Agent | ✅ Hoàn thành |

---

> **Ghi nhớ cuối:**  
> MCP không phải magic — nó chỉ là một giao thức chuẩn hóa.  
> Giá trị thực sự đến từ **cách bạn thiết kế Tools** và **cách bạn tích hợp vào workflow thực tế**.  
> Bắt đầu nhỏ: 1 server, 1 tool, 1 workflow. Rồi mở rộng dần.

---

*Trước đó: [DOC-004 — Xây dựng Custom MCP Server](./DOC-004-mcp-xay-dung-custom-server.md)*  
*Đầu series: [DOC-001 — MCP Tổng quan & Kiến trúc](./DOC-001-mcp-tong-quan-va-kien-truc.md)*
