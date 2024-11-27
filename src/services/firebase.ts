import firebase from '@react-native-firebase/app';
import '@react-native-firebase/auth';
import '@react-native-firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA70PlvTzdiUkUNblGRd8JeJgofqIVYP5E",
  authDomain: "transapparnika.firebaseapp.com",
  projectId: "transapparnika",
  storageBucket: "transapparnika.firebasestorage.app",
  messagingSenderId: "1060410124909",
  appId: "1:1060410124909:android:575d7b1c923779ce31ad64"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export default firebase;
