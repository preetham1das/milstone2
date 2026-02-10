
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";


const firebaseConfig = {
  apiKey: "AIzaSyCoKFBRuCa4B5Nkk9yYbKwsa3h3YR_-4tg",
  authDomain: "milestoneuser-19479.firebaseapp.com",
  projectId: "milestoneuser-19479",
  storageBucket: "milestoneuser-19479.firebasestorage.app",
  messagingSenderId: "963581720868",
  appId: "1:963581720868:web:e66dea0956bc7effe5dbb1",
  measurementId: "G-9RK1KH8SSF"
};


const app = initializeApp(firebaseConfig);


export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
