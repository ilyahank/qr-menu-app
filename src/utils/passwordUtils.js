import bcrypt from 'bcryptjs';

// Hash password before storing
export const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(12); // 12 rounds for strong hashing
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    console.error('Error hashing password:', error);
    throw new Error('Password hashing failed');
  }
};

// Verify password when logging in
export const verifyPassword = async (enteredPassword, storedHash) => {
  try {
    const isMatch = await bcrypt.compare(enteredPassword, storedHash);
    return isMatch;
  } catch (error) {
    console.error('Error verifying password:', error);
    throw new Error('Password verification failed');
  }
};
