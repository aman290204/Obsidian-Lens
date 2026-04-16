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
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

export async function uploadVideoToDrive(fileName: string, buffer: Buffer): Promise<{ fileId: string; webContentLink: string; webViewLink: string }> {
  if (!jwtClient) throw new Error("Google Drive Auth is not correctly configured.");
  if (!FOLDER_ID) throw new Error("GOOGLE_DRIVE_FOLDER_ID is strictly missing from .env.local.");

  const bufferStream = new stream.PassThrough();
  bufferStream.end(buffer);

  const fileMetadata = {
    name: fileName,
    parents: [FOLDER_ID]
  };

  const media = {
    mimeType: 'video/mp4',
    body: bufferStream
  };

  console.log(`[DriveClient] Uploading video ${fileName} to Drive...`);
  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: media,
    fields: 'id, webContentLink, webViewLink',
  });

  if (!res.data.id) {
    throw new Error("Failed to capture a valid File ID after uploading video to Drive.");
  }

  // Make the file publicly accessible so folks with link can download/view without being signed in 
  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });

  // Fetch updated public links
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
