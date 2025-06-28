// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, fetchSignInMethodsForEmail, sendEmailVerification } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBkEbvGk_kxL3d1IB2zgYFpbixUBJ8EV8c",
  authDomain: "mindsmeet-a8945.firebaseapp.com",
  projectId: "mindsmeet-a8945",
  storageBucket: "mindsmeet-a8945.firebasestorage.app",
  messagingSenderId: "273248409523",
  appId: "1:273248409523:web:88fc2d8eefacc665c8ddc6",
  measurementId: "G-H8QD41XT3P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

export { auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, fetchSignInMethodsForEmail, sendEmailVerification }; 