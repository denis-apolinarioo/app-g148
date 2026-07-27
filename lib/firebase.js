// Configuração de conexão com o Firebase.
// A apiKey de um app Web do Firebase NÃO é secreta — a segurança de verdade
// vem das regras do Firestore/Storage (arquivos firestore.rules e storage.rules),
// não de esconder essa chave. Por isso ela pode ficar direto no código.
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDbFZGOcB7bBGQo7pvzApga-ueS9c-HPbQ',
  authDomain: 'app-g148.firebaseapp.com',
  projectId: 'app-g148',
  storageBucket: 'app-g148.firebasestorage.app',
  messagingSenderId: '768487606718',
  appId: '1:768487606718:web:ff5e969846a6e9a8a811ef',
  measurementId: 'G-5QVQP6TCPW',
};

// Evita inicializar o app do Firebase mais de uma vez (comum em Next.js
// por causa do hot-reload durante o desenvolvimento).
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
