#!/usr/bin/env npx tsx
/**
 * Upload generated audio samples to Google Drive
 * ---------------------------------------------
 * Uploads files from public/audio-samples/ to a Google Drive folder.
 *
 * USAGE:
 *   npx tsx scripts/uploadToDrive.ts
 *
 * ENV VARS:
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON
 * - DRIVE_FOLDER_ID: Target folder ID in Google Drive
 *
 * This script uses your existing googleapis dependency.
 */

import { google } from 'googleapis';
import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { cwd } from 'process';

const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json';

if (!DRIVE_FOLDER_ID) {
  console.error('❌ DRIVE_FOLDER_ID environment variable not set');
  process.exit(1);
}

async function uploadFile(drive: any, folderId: string, filePath: string, fileName: string): Promise<string> {
  const fileContent = await readFile(filePath);

  const metadata: any = {
    name: fileName,
    parents: [folderId],
  };

  // Determine MIME type based on extension
  const mimeType = fileName.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';

  const media = {
    mimeType,
    body: fileContent,
  };

  const response = await drive.files.create({
    resource: metadata,
    media,
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = response.data.id;
  const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;

  console.log(`  ✓ Uploaded: ${fileName} → ${downloadUrl}`);

  return downloadUrl;
}

async function uploadDirectory(drive: any, localDir: string, driveFolderId: string, prefix: string = ''): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  const entries = await readdir(localDir, { withFileTypes: true });

  for (const entry of entries) {
    const localPath = join(localDir, entry.name);
    const stats = await stat(localPath);

    if (entry.isDirectory()) {
      // Create subfolder in Drive
      const folderMetadata = {
        name: entry.name,
        parents: [driveFolderId],
        mimeType: 'application/vnd.google-apps.folder',
      };

      const folderRes = await drive.files.create({
        resource: folderMetadata,
        fields: 'id',
      });

      const subfolderId = folderRes.data.id;
      console.log(`📁 Created folder: ${entry.name}`);

      // Recursively upload contents
      const subUrls = await uploadDirectory(drive, localPath, subfolderId, prefix ? `${prefix}/${entry.name}` : entry.name);
      for (const [relPath, url] of subUrls) {
        urlMap.set(relPath, url);
      }
    } else if (entry.name.endsWith('.wav') || entry.name.endsWith('.mp3')) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const url = await uploadFile(drive, driveFolderId, localPath, entry.name);
      urlMap.set(relativePath, url);
    }
  }

  return urlMap;
}

async function main() {
  console.log('='.repeat(60));
  console.log('GOOGLE DRIVE UPLOAD - AUDIO SAMPLES');
  console.log('='.repeat(60));

  // Authenticate using JWT (service account)
  const credentialsContent = await readFile(CREDENTIALS_PATH);
  const credentials = JSON.parse(credentialsContent.toString());

  const authClient = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  const drive = google.drive({ version: 'v3', auth: authClient });

  const samplesDir = join(cwd(), 'public', 'audio-samples');

  console.log(`Uploading from: ${samplesDir}`);
  console.log(`Target folder: ${DRIVE_FOLDER_ID}`);
  console.log('='.repeat(60));

  try {
    const urlMap = await uploadDirectory(drive, samplesDir, DRIVE_FOLDER_ID);

    console.log('='.repeat(60));
    console.log(`✅ Upload complete: ${urlMap.size} files`);

    // Output URL mapping for copying
    console.log('\n📋 URL Mapping for sampleAudio.ts:');
    console.log('-----------------------------------');

    const personas = new Set<string>();
    for (const relPath of urlMap.keys()) {
      const parts = relPath.split('/');
      if (parts.length === 2) {
        personas.add(parts[0]);
      }
    }

    console.log('export const SAMPLE_AUDIO: Record<string, Record<string, string>> = {');
    for (const persona of Array.from(personas).sort()) {
      console.log(`  ${persona}: {`);
      for (const [relPath, url] of urlMap.entries()) {
        if (relPath.startsWith(persona + '/')) {
          const fileName = relPath.split('/')[1];
          const lang = fileName.replace(/\.(wav|mp3)$/, '');
          console.log(`    ${lang}: '${url}',`);
        }
      }
      console.log('  },');
    }
    console.log('};');

  } catch (error: any) {
    console.error('❌ Upload failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
