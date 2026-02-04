// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Auth ke liye zaroori hai
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBvPItW6qkZvbQqy6b8b3ImHrbYtzgd3WI", // Updated API Key
  authDomain: "cuims-e0ec3.firebaseapp.com",
  projectId: "cuims-e0ec3",
  storageBucket: "cuims-e0ec3.firebasestorage.app",
  messagingSenderId: "311511118926",
  appId: "1:311511118926:web:a1fc892df446b4a6cc7f1f",
  measurementId: "G-D453FXX549"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // Ise export karna zaroori hai Login.jsx ke liye
const analytics = getAnalytics(app);

export { auth, analytics }; // Dono ko export karein
export default app;