// firebase.js — Firebase client SDK initialization
// The client config is intentionally public (Firebase security is via Firestore Rules)
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';

const firebaseConfig = {
  apiKey: "AIzaSyAz7oCzPLuKMexd-UaSooFdyZph7mQn24w",
  authDomain: "mindyou-2c6c4.firebaseapp.com",
  projectId: "mindyou-2c6c4",
  storageBucket: "mindyou-2c6c4.firebasestorage.app",
  messagingSenderId: "859084743437",
  appId: "1:859084743437:web:3746bd5ca727afff54c644"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Gemini backend with API key to bypass Vertex AI App Check requirement
const ai = getAI(app, { backend: new GoogleAIBackend({ apiKey: import.meta.env.VITE_GEMINI_API_KEY }) });

export const aiModel = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });

export default app;
