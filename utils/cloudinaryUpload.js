import cloudinary from '../config/cloudinary.js';

/**
 * Upload a file buffer to Cloudinary.
 *
 * Returns the Cloudinary result object on success (has .secure_url).
 * Throws a structured error on failure so callers can handle it properly.
 *
 * @param {Buffer} fileBuffer
 * @param {object} [options]   - extra Cloudinary upload options
 * @returns {Promise<object>}
 */
export const uploadOnCloudinary = async (fileBuffer, options = {}) => {
    if (!fileBuffer) throw new Error('No file buffer provided');

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'codeplatform_uploads',
                resource_type: 'image',
                ...options,
            },
            (error, result) => {
                if (error) {
                    // Surface the real Cloudinary error message
                    const msg =
                        error.message ||
                        (typeof error === 'object' ? JSON.stringify(error) : String(error));
                    const err = new Error(`Cloudinary upload failed: ${msg}`);
                    err.cloudinaryError = error;
                    err.httpCode = error.http_code;
                    reject(err);
                } else {
                    resolve(result);
                }
            }
        );
        uploadStream.end(fileBuffer);
    });
};
