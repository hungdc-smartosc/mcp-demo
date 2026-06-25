import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createDriveClient } from './gdrive.js';

const server = new Server(
  { name: 'google-drive-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

let drive: any;
try {
  drive = createDriveClient();
} catch (err: any) {
  console.error(`⚠️ Khởi động server bị gián đoạn: ${err.message}`);
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_files',
        description: 'Liệt kê files/folders trong Google Drive của tôi',
        inputSchema: {
          type: 'object',
          properties: {
            folderId: {
              type: 'string',
              description: 'ID của folder (mặc định: root)',
            },
            maxResults: {
              type: 'number',
              description: 'Số lượng kết quả tối đa (mặc định: 20)',
            },
          },
        },
      },
      {
        name: 'read_file',
        description: 'Đọc nội dung một file text hoặc Google Doc từ Google Drive',
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
        description: 'Tìm kiếm files trong Google Drive theo tên',
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
        description: 'Tạo và upload một file text mới lên Google Drive',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tên file' },
            content: { type: 'string', description: 'Nội dung file (dạng text)' },
            folderId: { type: 'string', description: 'ID folder lưu trữ (optional)' },
          },
          required: ['name', 'content'],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!drive) {
    return {
      content: [{ type: 'text', text: '❌ Server chưa được xác thực. Vui lòng chạy npm run auth trước.' }],
      isError: true,
    };
  }

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

        const files = response.data.files || [];
        const result = files.map((f: any) => ({
          id: f.id,
          name: f.name,
          type: f.mimeType,
          size: f.size,
          modified: f.modifiedTime,
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      }

      case 'read_file': {
        const fileId = args?.fileId as string;

        const metaRes = await drive.files.get({
          fileId,
          fields: 'mimeType, name',
        });
        const mimeType = metaRes.data.mimeType || '';

        let content: string;

        if (mimeType.includes('google-apps.document')) {
          // Export Google Docs as plain text
          const exportRes = await drive.files.export(
            { fileId, mimeType: 'text/plain' },
            { responseType: 'text' }
          );
          content = exportRes.data as string;
        } else {
          // Download raw text file
          const downloadRes = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'text' }
          );
          content = downloadRes.data as string;
        }

        return {
          content: [{ type: 'text', text: content }],
        };
      }

      case 'search_files': {
        const query = args?.query as string;

        const response = await drive.files.list({
          q: `name contains '${query}' and trashed = false`,
          pageSize: 20,
          fields: 'files(id, name, mimeType, modifiedTime)',
        });

        const files = response.data.files || [];
        return {
          content: [{ type: 'text', text: JSON.stringify(files, null, 2) }],
        };
      }

      case 'upload_file': {
        const { name: filename, content: fileContent, folderId } = args as {
          name: string;
          content: string;
          folderId?: string;
        };

        const fileMetadata: any = { name: filename };
        if (folderId) fileMetadata.parents = [folderId];

        const media = {
          mimeType: 'text/plain',
          body: fileContent,
        };

        const response = await drive.files.create({
          requestBody: fileMetadata,
          media,
          fields: 'id, name, webViewLink',
        });

        return {
          content: [
            {
              type: 'text',
              text: `✅ Upload thành công!\nTên file: ${response.data.name}\nID: ${response.data.id}\nLink: ${response.data.webViewLink}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Tool không tồn tại: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `❌ Lỗi thực thi tool: ${error.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('🚀 Google Drive MCP Server is running...');
}

main().catch((err) => {
  console.error('Fatal error during startup:', err);
});
