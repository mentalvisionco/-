const { google } = require('googleapis');
const { PassThrough } = require('stream');

// Initialize Google OAuth2 client instead of Service Account GoogleAuth
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

// Drive client instance
const drive = auth ? google.drive({ version: 'v3', auth }) : null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a function with exponential backoff retries for transient errors.
 */
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

/**
 * Uploads a file buffer directly to Google Drive.
 * @param {Object} file - Multer file object (contains buffer, originalname, mimetype)
 * @param {string} [uniqueName] - Optional sanitized, unique name to save the file as
 * @returns {Promise<Object>} Object containing fileId, fileUrl, and compatibility keys (id, webViewLink)
 */
async function uploadFileToDrive(file, uniqueName) {
  if (!drive) {
    throw new Error('Google Drive integration is not configured or initialized.');
  }

  // Fallback to a unique generated name if uniqueName was not supplied by the caller
  const nameToSave = uniqueName || `${Date.now()}-${file.originalname || 'file'}`;

  // Create PassThrough stream from the buffer as required
  const bufferStream = new PassThrough();
  bufferStream.end(file.buffer);

  const fileMetadata = {
    name: nameToSave,
  };

  // Set parents if a specific folder ID is configured
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (folderId) {
    fileMetadata.parents = [folderId];
  }

  const media = {
    mimeType: file.mimetype,
    body: bufferStream,
  };

  // Upload file with retry
  const response = await retryWithBackoff(async () => {
    return await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id',
    });
  });

  const fileId = response.data.id;

  // Make the file publicly accessible by link (anyone with link can view)
  // PUBLIC BY LINK PERMISSION:
  await retryWithBackoff(async () => {
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });
  });

  // Construct link using target format
  const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;

  // Return both camelCase and legacy expected keys for full backward compatibility
  return {
    id: fileId,
    fileId: fileId,
    webViewLink: fileUrl,
    fileUrl: fileUrl,
  };
}

/**
 * Safely deletes a file from Google Drive if it exists.
 * @param {string} fileId - The ID of the file to delete
 * @returns {Promise<boolean>} True if deleted or already missing, false otherwise
 */
async function deleteDriveFile(fileId) {
  if (!drive || !fileId) return false;

  try {
    await retryWithBackoff(async () => {
      await drive.files.delete({ fileId: fileId });
    });
    console.log(`✅ Successfully deleted Google Drive file: ${fileId}`);
    return true;
  } catch (err) {
    // If the file is already gone (404), count as success
    if (err.status === 404) {
      console.log(`ℹ️ Google Drive file ${fileId} already deleted or not found.`);
      return true;
    }
    console.error(`⚠️ Failed to delete Google Drive file ${fileId}:`, err.message);
    return false;
  }
}

/**
 * Retrieves a file stream and metadata from Google Drive.
 * @param {string} fileId - The ID of the file to retrieve
 * @returns {Promise<Object>} Object with { stream, name, mimeType, size }
 */
async function getDriveFileStream(fileId) {
  if (!drive) {
    throw new Error('Google Drive integration is not configured or initialized.');
  }

  // Get file metadata first
  const metadata = await retryWithBackoff(async () => {
    return await drive.files.get({
      fileId: fileId,
      fields: 'name, mimeType, size',
    });
  });

  // Get file media content stream
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
  uploadFileToDrive,
  deleteDriveFile,
  getDriveFileStream,
};


