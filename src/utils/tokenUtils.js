import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.REACT_APP_JWT_SECRET || 'your-secret-key-change-this';
const TOKEN_EXPIRY = '24h'; // 24 hours

export const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role, iat: Date.now() },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
};

export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error('Token decode failed:', error);
    return null;
  }
};

export const isTokenExpired = (token) => {
  const decoded = decodeToken(token);
  if (!decoded) return true;
  return decoded.exp * 1000 < Date.now();
};

export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh', iat: Date.now() },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

export const rotateToken = (oldToken) => {
  const decoded = verifyToken(oldToken);
  if (!decoded) return null;
  
  // Generate new token
  const newToken = generateToken(decoded.userId, decoded.role);
  
  // Blacklist old token (optional - requires token blacklist DB)
  return newToken;
};
