const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const validateImage = (file) => {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size must be less than 5MB');
  }

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are allowed');
  }

  // Check file extension
  const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  const extension = file.name.split('.').pop().toLowerCase();
  if (!validExtensions.includes(extension)) {
    throw new Error('Invalid file extension');
  }

  return true;
};

export const sanitizeFilename = (filename) => {
  // Remove special characters
  return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
};

export const generateSecureFilepath = (restaurantId, filename) => {
  const timestamp = Date.now();
  const sanitized = sanitizeFilename(filename);
  return `${restaurantId}/${timestamp}-${sanitized}`;
};
