import { google } from 'googleapis';
import stream from 'stream';

const b64Key = process.env.GOOGLE_SERVICE_ACCOUNT_B64 || '';
let jwtClient: any = null;

if (b64Key) {
  try {
    const credsStr = Buffer.from(b64Key, 'base64').toString('utf8');
    const credentials = JSON.parse(credsStr);
    jwtClient = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
  } catch (e) {
    console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_B64. Drive won't work.", e);
  }
}

const drive = google.drive({ version: 'v3', auth: jwtClient });
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

// Folder cache to avoid repeated API calls
const folderCache = new Map<string, string>();

export async function ensureFolderExists(folderPath: string): Promise<string> {
  if (folderCache.has(folderPath)) {
    return folderCache.get(folderPath)!;
  }

  if (!jwtClient) throw new Error("Google Drive Auth not configured");
  if (!ROOT_FOLDER_ID) throw new Error("GOOGLE_DRIVE_FOLDER_ID missing");

  const parts = folderPath.split('/').filter(Boolean);
  let currentParentId = ROOT_FOLDER_ID;
  let currentPath = '';

  for (const part of parts) {
    currentPath += `/${part}`;

    if (folderCache.has(currentPath)) {
      currentParentId = folderCache.get(currentPath)!;
      continue;
    }

    const searchResponse = await drive.files.list({
      q: `name='${part}' and mimeType='application/vnd.google-apps.folder' and '${currentParentId}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    let folderId: string;
    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      folderId = searchResponse.data.files[0].id!;
    } else {
      const fileMetadata = {
        name: part,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [currentParentId],
      };
      const createRes = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
      });
      folderId = createRes.data.id!;
    }

    folderCache.set(currentPath, folderId);
    currentParentId = folderId;
  }

  return currentParentId;
}

export async function uploadVideoToDrive(
  fileName: string,
  buffer: Buffer,
  folderPath: string = '/'
): Promise<{ fileId: string; webContentLink: string; webViewLink: string }> {
  if (!jwtClient) throw new Error("Google Drive Auth is not correctly configured.");
  if (!ROOT_FOLDER_ID) throw new Error("GOOGLE_DRIVE_FOLDER_ID is missing from .env.local.");

  const targetFolderId = await ensureFolderExists(folderPath);

  const bufferStream = new stream.PassThrough();
  bufferStream.end(buffer);

  const fileMetadata = {
    name: fileName,
    parents: [targetFolderId]
  };

  const media = {
    mimeType: 'video/mp4',
    body: bufferStream
  };

  console.log(`[DriveClient] Uploading ${fileName} to ${folderPath}`);
  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webContentLink, webViewLink',
  });

  if (!res.data.id) {
    throw new Error("Failed to capture a valid File ID after uploading video to Drive.");
  }

  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' }
  });

  const updated = await drive.files.get({
    fileId: res.data.id,
    fields: 'webContentLink, webViewLink'
  });

  console.log(`[DriveClient] ✅ Upload complete: ${updated.data.webViewLink}`);
  return {
    fileId: res.data.id,
    webContentLink: updated.data.webContentLink || '',
    webViewLink: updated.data.webViewLink || ''
  };
}
