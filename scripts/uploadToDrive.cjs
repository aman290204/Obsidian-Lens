#!/usr/bin/env node
/**
 * Upload audio samples to Google Drive
 */

const { google } = require('googleapis');
const { readdir, readFile, stat } = require('fs/promises');
const { join } = require('path');
const { cwd } = require('process');

const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || '1sX8Vc5qtyQVkr2fOem-RoxdcgtPN3BYx';
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials.json';

if (!DRIVE_FOLDER_ID) {
  console.error('Missing DRIVE_FOLDER_ID');
  process.exit(1);
}

async function uploadFile(drive, folderId, filePath, fileName) {
  const fileContent = await readFile(filePath);

  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const mimeType = fileName.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';

  const media = { mimeType, body: fileContent };

 const response = await drive.files.create({
    resource: metadata,
    media,
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = response.data.id;
  const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;

  console.log(`  ✓ ${fileName} → ${downloadUrl.substring(0, 60)}...`);

  return downloadUrl;
}

async function uploadDirectory(drive, localDir, driveFolderId, prefix = '') {
  const urlMap = new Map();
  const entries = await readdir(localDir, { withFileTypes: true });

  for (const entry of entries) {
    const localPath = join(localDir, entry.name);
    const stats = await stat(localPath);

    if (entry.isDirectory()) {
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
      console.log(`📁 ${entry.name}/`);

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
  console.log('UPLOAD AUDIO SAMPLES TO GOOGLE DRIVE');
  console.log('='.repeat(60));

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: 'v3', auth: authClient });

  const samplesDir = join(cwd(), 'public', 'audio-samples');

  console.log(`From: ${samplesDir}`);
  console.log(`To: ${DRIVE_FOLDER_ID}`);
  console.log('='.repeat(60));

  try {
    const urlMap = await uploadDirectory(drive, samplesDir, DRIVE_FOLDER_ID);

    console.log('='.repeat(60));
    console.log(`✅ Uploaded ${urlMap.size} files`);

    // Generate URL mapping
    const personas = new Set();
    for (const relPath of urlMap.keys()) {
      const parts = relPath.split('/');
      if (parts.length === 2) personas.add(parts[0]);
    }

    console.log('\nURL mapping for sampleAudio.ts:');
    console.log('---');
    console.log('export const SAMPLE_AUDIO = {');
    for (const persona of Array.from(personas).sort()) {
      console.log(`  ${persona}: {`);
      for (const [relPath, url] of urlMap.entries()) {
        if (relPath.startsWith(persona + '/')) {
          const lang = relPath.split('/')[1].replace(/\.(wav|mp3)$/, '');
          console.log(`    ${lang}: '${url}',`);
        }
      }
      console.log('  },');
    }
    console.log('};');

    // Save to file for Redis caching
    const mapping = {};
    for (const [relPath, url] of urlMap.entries()) {
      const [persona, file] = relPath.split('/');
      if (!mapping[persona]) mapping[persona] = {};
      mapping[persona][file.replace(/\.(wav|mp3)$/, '')] = url;
    }

    const { writeFile } = require('fs/promises');
    await writeFile('urls.json', JSON.stringify(mapping, null, 2));
    console.log('\nSaved mapping to urls.json for Redis caching');

  } catch (error) {
    console.error('Upload failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
