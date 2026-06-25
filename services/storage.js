const { google } = require('googleapis');
const { PassThrough } = require('stream');

let auth;
try {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({
      refresh_token: refreshToken,
    });
    console.log('✅ Google Drive API initialized with OAuth2 User Credentials');
  } else {
    console.warn('⚠️ Warning: Google Drive OAuth2 credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN) are not fully configured. File upload features will be unavailable.');
  }
} catch (err) {
  console.error('❌ Failed to initialize Google Drive Auth:', err.message);
}

const drive = auth ? google.drive({ version: 'v3', auth }) : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryWithBackoff(fn, retries = 3, delay = 1000) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const status = err.status || (err.response && err.response.status);
      const isTransient = !status || [429, 500, 503].includes(status);
      
      if (!isTransient || attempt >= retries) {
        throw err;
      }
      
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      console.warn(`⚠️ Google Drive API warning (status ${status || 'network'}). Retrying attempt ${attempt}/${retries} in ${backoffDelay}ms...`);
      await sleep(backoffDelay);
    }
  }
}

async function getOrCreateFolder(name, parentId) {
  if (!drive) return parentId;

  const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = `name = '${escapedName}' and mimeType = 'application/vnd.google-apps.folder' and '${parentId}' in parents and trashed = false`;

  const response = await retryWithBackoff(async () => {
    return await drive.files.list({
      q: query,
      spaces: 'drive',
      fields: 'files(id, name)',
    });
  });

  const files = response.data.files;
  if (files && files.length > 0) {
    return files[0].id;
  }

  const fileMetadata = {
    name: name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };

  const createResponse = await retryWithBackoff(async () => {
    return await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });
  });

  return createResponse.data.id;
}

async function uploadFile(file, uniqueName, folderName) {
  if (!drive) {
    throw new Error('Google Drive integration is not configured or initialized.');
  }

  const nameToSave = uniqueName || `${Date.now()}-${file.originalname || 'file'}`;

  const bufferStream = new PassThrough();
  bufferStream.end(file.buffer);

  const fileMetadata = {
    name: nameToSave,
  };

  let parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (parentFolderId && folderName) {
    try {
      parentFolderId = await getOrCreateFolder(folderName, parentFolderId);
    } catch (folderError) {
      console.error(`⚠️ Failed to resolve folder "${folderName}", uploading to parent folder instead:`, folderError.message);
      parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    }
  }

  if (parentFolderId) {
    fileMetadata.parents = [parentFolderId];
  }

  const media = {
    mimeType: file.mimetype,
    body: bufferStream,
  };

  const response = await retryWithBackoff(async () => {
    return await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });
  });

  const fileId = response.data.id;

  await retryWithBackoff(async () => {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
  });

  const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;

  return {
    id: fileId,
    fileId: fileId,
    webViewLink: fileUrl,
    fileUrl: fileUrl,
  };
}

async function deleteFile(fileId) {
  if (!drive || !fileId) return false;

  try {
    await retryWithBackoff(async () => {
      await drive.files.delete({ fileId: fileId });
    });
    console.log(`✅ Successfully deleted Google Drive file: ${fileId}`);
    return true;
  } catch (err) {
    if (err.status === 404) {
      console.log(`ℹ️ Google Drive file ${fileId} already deleted or not found.`);
      return true;
    }
    console.error(`⚠️ Failed to delete Google Drive file ${fileId}:`, err.message);
    return false;
  }
}

async function getFileStream(fileId) {
  if (!drive) {
    throw new Error('Google Drive integration is not configured or initialized.');
  }

  const metadata = await retryWithBackoff(async () => {
    return await drive.files.get({
      fileId: fileId,
      fields: 'name, mimeType, size',
    });
  });

  const response = await retryWithBackoff(async () => {
    return await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );
  });

  return {
    stream: response.data,
    name: metadata.data.name,
    mimeType: metadata.data.mimeType,
    size: metadata.data.size,
  };
}

module.exports = {
  drive,
  uploadFile,
  deleteFile,
  getFileStream,
};
