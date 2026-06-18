const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Function to create a QR code URL
exports.getQRCode = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }
  
  const restaurantId = data.restaurantId;
  if (!restaurantId) {
    throw new functions.https.HttpsError('invalid-argument', 'Restaurant ID required');
  }
  
  // Verify user owns this restaurant
  const userDoc = await admin.firestore().doc(`users/${context.auth.uid}`).get();
  if (!userDoc.exists || userDoc.data().restaurantId !== restaurantId) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }
  
  // Return QR code URL
  const baseUrl = 'https://yourdomain.com';
  return {
    url: `${baseUrl}/r/${restaurantId}`
  };
});
