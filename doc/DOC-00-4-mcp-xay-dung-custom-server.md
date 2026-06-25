# DOC-00-4: Xây dựng Custom MCP Server từ đầu

> **Đối tượng:** Software Engineers, Backend Developers (Linux/Ubuntu)  
> **Phiên bản:** 1.0 — 2026-06-25  
> **Series:** Bộ tài liệu Model Context Protocol (MCP)

---

## Mục lục

1. [Khi nào cần Custom MCP Server?](#1-khi-nào-cần-custom-mcp-server)
2. [Cấu trúc project TypeScript chuẩn](#2-cấu-trúc-project-typescript-chuẩn)
3. [Skeleton MCP Server — Bộ khung tối thiểu](#3-skeleton-mcp-server--bộ-khung-tối-thiểu)
4. [Implement các loại Tool thực tế](#4-implement-các-loại-tool-thực-tế)
5. [Xử lý lỗi & Response format chuẩn](#5-xử-lý-lỗi--response-format-chuẩn)
6. [Build, Deploy và Reload](#6-build-deploy-và-reload)

---

## 1. Khi nào cần Custom MCP Server?

### 1.1 Giới hạn của package có sẵn

| Tình huống | Package có sẵn | Custom Server |
|---|---|---|
| Kết nối Google Drive cơ bản | ✅ Đủ | Không cần |
| Kết nối internal API nội bộ công ty | ❌ Không có | ✅ Cần |
| Thêm business logic (phân quyền, validate) | ❌ Không thể | ✅ Cần |
| Tích hợp nhiều service trong 1 server | ❌ Không thể | ✅ Cần |
| Cần audit log mỗi lần AI gọi Tool | ❌ Không thể | ✅ Cần |
| Cần retry logic, circuit breaker | ❌ Không thể | ✅ Cần |

### 1.2 Use case phổ biến trong dự án thực tế

- **Internal API Gateway:** AI gọi API nội bộ SmartOSC qua MCP thay vì expose trực tiếp.
- **Tổng hợp nhiều nguồn:** 1 MCP Server kết nối cả Google Drive + Jira + Confluence.
- **Kiểm soát quyền:** Giới hạn AI chỉ được đọc, không được xóa dữ liệu.
- **Transform data:** Định dạng lại dữ liệu trước khi trả về cho AI.

---

## 2. Cấu trúc project TypeScript chuẩn

### 2.1 Khởi tạo project

```bash
# Tạo project
mkdir my-mcp-server && cd my-mcp-server
npm init -y

# Cài dependencies
npm install @modelcontextprotocol/sdk
npm install -D typescript @types/node tsx

# Tạo cấu trúc thư mục
mkdir src
```

### 2.2 Cấu trúc thư mục

```
my-mcp-server/
├── src/
│   ├── index.ts        ← Entry point: khởi tạo Server, kết nối Transport
│   ├── tools/
│   │   ├── index.ts    ← Export tất cả tool definitions
│   │   ├── fileTools.ts
│   │   └── apiTools.ts
│   └── utils/
│       └── response.ts ← Helper tạo response chuẩn
├── dist/               ← Output (tự động tạo khi build)
├── package.json
├── tsconfig.json
└── .gitignore
```

### 2.3 package.json

```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 2.4 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 3. Skeleton MCP Server — Bộ khung tối thiểu

Đây là template đầy đủ để bắt đầu bất kỳ Custom MCP Server nào:

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// ─── 1. Khởi tạo Server instance ─────────────────────────────
const server = new Server(
  {
    name: 'my-mcp-server',    // Tên định danh server
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},              // Khai báo server này hỗ trợ Tools
    },
  }
);

// ─── 2. Khai báo danh sách Tools ─────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'say_hello',
        description: 'Chào hỏi một người dùng theo tên',
        inputSchema: {
          type: 'object' as const,
          properties: {
            name: {
              type: 'string',
              description: 'Tên người cần chào',
            },
          },
          required: ['name'],
        },
      },
      // Thêm tool khác ở đây...
    ],
  };
});

// ─── 3. Xử lý khi AI gọi Tool ────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'say_hello': {
      const userName = args?.name as string;
      return {
        content: [
          {
            type: 'text',
            text: `Xin chào, ${userName}! 👋`,
          },
        ],
      };
    }

    default:
      throw new Error(`Tool không tồn tại: ${name}`);
  }
});

// ─── 4. Kết nối Transport và khởi động ───────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Dùng console.error thay vì console.log
  // vì stdout được dành riêng cho JSON-RPC messages
  console.error('✅ MCP Server đang chạy...');
}

main().catch((err) => {
  console.error('❌ Server khởi động thất bại:', err);
  process.exit(1);
});
```

> **Quan trọng:** Dùng `console.error()` cho mọi log trong MCP Server.  
> `stdout` được dành riêng cho giao tiếp JSON-RPC — ghi bất cứ thứ gì vào `stdout` ngoài JSON-RPC sẽ làm hỏng giao thức.

---

## 4. Implement các loại Tool thực tế

### 4.1 Tool đọc/ghi file hệ thống

```typescript
// src/tools/fileTools.ts
import * as fs from 'fs';
import * as path from 'path';

// Giới hạn AI chỉ được truy cập thư mục cho phép
const ALLOWED_BASE_DIR = '/home/ubuntu/projects';

export const fileTools = [
  {
    name: 'read_local_file',
    description: 'Đọc nội dung file từ hệ thống local',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Đường dẫn file (tương đối)' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'write_local_file',
    description: 'Ghi nội dung vào file trên hệ thống local',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: { type: 'string', description: 'Đường dẫn file' },
        content: { type: 'string', description: 'Nội dung cần ghi' },
      },
      required: ['filePath', 'content'],
    },
  },
];

export async function handleFileTool(name: string, args: any) {
  switch (name) {
    case 'read_local_file': {
      // Bảo mật: Kiểm tra đường dẫn không vượt ra ngoài thư mục cho phép
      const fullPath = path.resolve(ALLOWED_BASE_DIR, args.filePath);
      if (!fullPath.startsWith(ALLOWED_BASE_DIR)) {
        throw new Error('Truy cập bị từ chối: Đường dẫn nằm ngoài thư mục cho phép.');
      }
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File không tồn tại: ${fullPath}`);
      }
      const content = fs.readFileSync(fullPath, 'utf-8');
      return { content: [{ type: 'text', text: content }] };
    }

    case 'write_local_file': {
      const fullPath = path.resolve(ALLOWED_BASE_DIR, args.filePath);
      if (!fullPath.startsWith(ALLOWED_BASE_DIR)) {
        throw new Error('Truy cập bị từ chối.');
      }
      // Tạo thư mục cha nếu chưa tồn tại
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, args.content, 'utf-8');
      return { content: [{ type: 'text', text: `✅ Đã ghi file: ${fullPath}` }] };
    }

    default:
      throw new Error(`File tool không tồn tại: ${name}`);
  }
}
```

### 4.2 Tool gọi REST API bên ngoài

```typescript
// src/tools/apiTools.ts

export const apiTools = [
  {
    name: 'get_weather',
    description: 'Lấy thông tin thời tiết của một thành phố',
    inputSchema: {
      type: 'object' as const,
      properties: {
        city: { type: 'string', description: 'Tên thành phố (tiếng Anh)' },
      },
      required: ['city'],
    },
  },
  {
    name: 'call_internal_api',
    description: 'Gọi Internal API của công ty',
    inputSchema: {
      type: 'object' as const,
      properties: {
        endpoint: { type: 'string', description: 'Đường dẫn endpoint (không cần base URL)' },
        method: { type: 'string', description: 'HTTP method: GET, POST, PUT, DELETE' },
        body: { type: 'object', description: 'Request body (tùy chọn)' },
      },
      required: ['endpoint', 'method'],
    },
  },
];

const INTERNAL_API_BASE = process.env.INTERNAL_API_URL || 'https://api.internal.company.com';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export async function handleApiTool(name: string, args: any) {
  switch (name) {
    case 'get_weather': {
      const apiKey = process.env.WEATHER_API_KEY;
      if (!apiKey) throw new Error('Thiếu WEATHER_API_KEY trong environment variables.');

      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${args.city}&appid=${apiKey}&units=metric&lang=vi`
      );
      if (!response.ok) throw new Error(`Weather API lỗi: ${response.statusText}`);

      const data = await response.json() as any;
      const result = `🌤️ Thời tiết tại ${data.name}:\n` +
        `- Nhiệt độ: ${data.main.temp}°C (cảm giác ${data.main.feels_like}°C)\n` +
        `- Độ ẩm: ${data.main.humidity}%\n` +
        `- Mô tả: ${data.weather[0].description}`;
      return { content: [{ type: 'text', text: result }] };
    }

    case 'call_internal_api': {
      if (!INTERNAL_API_KEY) throw new Error('Thiếu INTERNAL_API_KEY.');

      const url = `${INTERNAL_API_BASE}${args.endpoint}`;
      const response = await fetch(url, {
        method: args.method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': INTERNAL_API_KEY,
        },
        body: args.body ? JSON.stringify(args.body) : undefined,
      });

      const data = await response.json();
      return {
        content: [{
          type: 'text',
          text: `Status: ${response.status}\n${JSON.stringify(data, null, 2)}`,
        }],
      };
    }

    default:
      throw new Error(`API tool không tồn tại: ${name}`);
  }
}
```

### 4.3 Kết hợp nhiều Tool trong index.ts

```typescript
// src/index.ts — Phiên bản đầy đủ với nhiều nhóm Tool
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { fileTools, handleFileTool } from './tools/fileTools.js';
import { apiTools, handleApiTool } from './tools/apiTools.js';

const server = new Server(
  { name: 'my-company-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

// Gộp tất cả tools từ các module
const ALL_TOOLS = [...fileTools, ...apiTools];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  console.error(`🔧 Tool được gọi: ${name}`, JSON.stringify(args));

  // Điều phối đến handler phù hợp
  const fileToolNames = fileTools.map(t => t.name);
  const apiToolNames = apiTools.map(t => t.name);

  if (fileToolNames.includes(name)) return handleFileTool(name, args);
  if (apiToolNames.includes(name)) return handleApiTool(name, args);

  throw new Error(`Tool không tồn tại: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`✅ my-company-mcp đang chạy với ${ALL_TOOLS.length} tools.`);
}
main().catch(console.error);
```

---

## 5. Xử lý lỗi & Response format chuẩn

### 5.1 Cấu trúc Response hợp lệ

MCP Server phải trả về response theo đúng cấu trúc:

```typescript
// ✅ Response thành công
return {
  content: [
    { type: 'text', text: 'Nội dung kết quả dạng text' },
    // Có thể có nhiều content items
  ],
};

// ✅ Response lỗi (có isError: true)
return {
  content: [
    { type: 'text', text: '❌ Mô tả lỗi chi tiết' },
  ],
  isError: true,
};

// ❌ KHÔNG throw Error trực tiếp trong handler
// (ngoại trừ lỗi "Tool không tồn tại")
```

### 5.2 Wrapper xử lý lỗi toàn cục

```typescript
// src/utils/response.ts

// Helper tạo response thành công
export function successResponse(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

// Helper tạo response lỗi
export function errorResponse(message: string) {
  console.error(`❌ Tool Error: ${message}`);
  return {
    content: [{ type: 'text' as const, text: `❌ Lỗi: ${message}` }],
    isError: true,
  };
}

// Wrapper tự động bắt exception
export async function safeExecute(
  toolName: string,
  fn: () => Promise<any>
) {
  try {
    return await fn();
  } catch (error: any) {
    console.error(`❌ [${toolName}] ${error.message}`);
    return errorResponse(error.message);
  }
}
```

Sử dụng trong handler:

```typescript
import { safeExecute, successResponse } from '../utils/response.js';

case 'read_local_file': {
  return safeExecute('read_local_file', async () => {
    const content = fs.readFileSync(fullPath, 'utf-8');
    return successResponse(content);
  });
}
```

---

## 6. Build, Deploy và Reload

### 6.1 Build TypeScript

```bash
# Build một lần
npm run build

# Build và watch (tự động rebuild khi code thay đổi)
npx tsc --watch

# Kiểm tra dist/ sau khi build
ls dist/
# index.js  tools/fileTools.js  tools/apiTools.js  utils/response.js
```

### 6.2 Cấu hình mcp_config.json

```json
{
  "mcpServers": {
    "my-company-mcp": {
      "command": "node",
      "args": ["/home/ubuntu/my-mcp-server/dist/index.js"],
      "cwd": "/home/ubuntu/my-mcp-server",
      "env": {
        "INTERNAL_API_URL": "https://api.internal.company.com",
        "INTERNAL_API_KEY": "your-api-key-here",
        "WEATHER_API_KEY": "your-weather-key-here"
      }
    }
  }
}
```

### 6.3 Quy trình khi sửa code

```bash
# 1. Sửa code TypeScript trong src/
# 2. Rebuild
npm run build

# 3. Reload trong Antigravity IDE:
#    Manage MCPs → Click "Refresh"
# Không cần restart toàn bộ IDE!
```

### 6.4 Kiểm tra server hoạt động

```bash
# Test nhanh: chạy thủ công và gõ JSON-RPC
node dist/index.js
# (Terminal khác)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js
```

---

## Tóm tắt — Checklist xây dựng Custom MCP Server

```
□ Khởi tạo project: npm init, cài @modelcontextprotocol/sdk
□ Cấu hình tsconfig.json với "module": "ESNext"
□ Tạo Server instance với name + version
□ setRequestHandler(ListToolsRequestSchema) → khai báo tools
□ setRequestHandler(CallToolRequestSchema) → xử lý tool call
□ Dùng console.error() cho log, KHÔNG dùng console.log()
□ Return { content: [...] } cho success
□ Return { content: [...], isError: true } cho error
□ npm run build → tạo dist/
□ Thêm credentials/token vào .gitignore
□ Cập nhật mcp_config.json
□ Reload MCP trong IDE
□ Kiểm tra Tools xuất hiện trong Manage MCPs
```

---

*Trước đó: [DOC-00-3 — Cài đặt GDrive & Database MCP](./DOC-00-3-mcp-gdrive-database-setup.md)*  
*Tiếp theo: [DOC-00-5 — Tích hợp MCP vào Workflow tự động](./DOC-00-5-mcp-tich-hop-workflow-tu-dong.md)*
