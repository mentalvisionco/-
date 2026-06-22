const googleDrive = require('./googleDrive');

/**
 * Unified storage provider abstraction layer.
 * Facilitates switching to S3, R2, or Supabase in the future.
 */

/**
 * Uploads a file to the active storage provider.
 * @param {Object} file - Multer file object
 * @param {string} [uniqueName] - Sanitized, unique name for the file
 * @param {string} [folderName] - Optional folder name to organize the file under
 * @returns {Promise<Object>} Object with { fileId, fileUrl }
 */
async function uploadFile(file, uniqueName, folderName) {
  return await googleDrive.uploadFileToDrive(file, uniqueName, folderName);
}

/**
 * Deletes a file from the active storage provider.
 * @param {string} fileId - The unique identifier of the file to delete
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteFile(fileId) {
  return await googleDrive.deleteDriveFile(fileId);
}

/**
 * Retrieves a file stream and metadata from the active storage provider.
 * @param {string} fileId - The unique identifier of the file
 * @returns {Promise<Object>} Object with { stream, name, mimeType, size }
 */
async function getFileStream(fileId) {
  return await googleDrive.getDriveFileStream(fileId);
}

module.exports = {
  uploadFile,
  deleteFile,
  getFileStream,
};

