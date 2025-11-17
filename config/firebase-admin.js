const admin  = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const initializeFirebaseAdmin = () => {
  try {
    if (admin.apps.length > 0) {
      console.log('✅ Firebase Admin already initialized');
      return admin.app();
    }

    // Get values from environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    // Validate environment variables
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Missing Firebase environment variables. Please check your .env file'
      );
    }

    console.log('🔧 Initializing Firebase Admin with project:', projectId);

    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key: privateKey,
      client_email: clientEmail,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin initialized successfully');
    return admin;
  } catch (error) {
    console.error('❌ Firebase Admin initialization failed:');
    console.error('   Error:', error.message);
    console.error('   Make sure your .env file has FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY');
    throw error;
  }
};

export default initializeFirebaseAdmin();