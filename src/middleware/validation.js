export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove dangerous characters
  return input
    .replace(/[<>\"']/g, '') // Remove HTML/script tags
    .trim();
};

export const validateEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const validatePhone = (phone) => {
  const regex = /^\+?[0-9\s\-()]{7,}$/;
  return regex.test(phone);
};
