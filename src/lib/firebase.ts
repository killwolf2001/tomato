import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAXmQAfSNfB16rBu1DwypCPZT7UKRAWeWk",
  authDomain: "tomato-timer-69fee.firebaseapp.com",
  projectId: "tomato-timer-69fee",
  storageBucket: "tomato-timer-69fee.firebasestorage.app",
  messagingSenderId: "338374786516",
  appId: "1:338374786516:web:35d7934581bc11d78cea41",
  measurementId: "G-542BHXP039"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
