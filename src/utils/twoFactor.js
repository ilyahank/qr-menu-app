import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export const generateTwoFactorSecret = (username) => {
  const secret = speakeasy.generateSecret({
    name: `IRM (${username})`,
    issuer: 'IRM Restaurant',
    length: 32
  });
  
  return {
    secret: secret.base32,
    qrCode: secret.otpauth_url
  };
};

export const generateQRCode = async (otpauthUrl) => {
  try {
    return await QRCode.toDataURL(otpauthUrl);
  } catch (error) {
    console.error('QR code generation failed:', error);
    throw error;
  }
};

export const verifyTwoFactorToken = (token, secret) => {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2 // Allow 2 time windows
  });
};
