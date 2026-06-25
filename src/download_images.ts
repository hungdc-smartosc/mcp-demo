import { createDriveClient } from './gdrive.js';
import * as fs from 'fs';
import * as path from 'path';

const IMAGES_DIR = path.join(process.cwd(), 'images');

const filesToDownload = [
  { id: '114LWpd2Bmr7Mi8M2nAT4_x12oeyWGbR_', name: 'MCP 4.jpg' },
  { id: '1uuTNQNERVykaUeJ3S5mRYFQlyfPUJ1eA', name: 'MCP3.jpg' },
  { id: '1aiRVyxMpVjxrRah47EB2LuM1iq3hXsjg', name: 'MCP2.jpg' },
  { id: '1QvT0CbgjRaSS_scI73TwfBpMdFMXyScN', name: 'MCP 1.jpg' }
];

async function downloadImages() {
  const drive = createDriveClient();

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  for (const file of filesToDownload) {
    const destPath = path.join(IMAGES_DIR, file.name);
    console.log(`Downloading ${file.name} to ${destPath}...`);
    try {
      const response = await drive.files.get(
        { fileId: file.id, alt: 'media' },
        { responseType: 'stream' }
      );
      
      await new Promise<void>((resolve, reject) => {
        const dest = fs.createWriteStream(destPath);
        response.data
          .on('end', () => {
            console.log(`Successfully downloaded ${file.name}`);
            resolve();
          })
          .on('error', (err: any) => {
            console.error(`Error downloading ${file.name}:`, err);
            reject(err);
          })
          .pipe(dest);
      });
    } catch (error: any) {
      console.error(`Failed to download ${file.name}:`, error.message);
    }
  }
}

downloadImages().catch(console.error);
