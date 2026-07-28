/* eslint-disable */
'use client';

import { useState } from 'react';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/lib/authContext';
import { compressImage } from '@/lib/imageCompress';
import { X, Image as ImageIcon, Loader2, Send } from 'lucide-react';

export default function CreatePostSheet({ isOpen, onClose }) {
  const { user, userData } = useAuth();
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handlePost = async () => {
    if (!text && !image) return;
    setLoading(true);

    try {
      let imageUrl = '';
      if (image) {
        const compressed = await compressImage(image);
        const imageRef = ref(storage, `posts/${Date.now()}_${user.uid}`);
        await uploadBytes(imageRef, compressed);
        imageUrl = await getDownloadURL(imageRef);
      }

      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        userName: userData?.nome || 'Usuário',
        userPhoto: userData?.fotoPerfil || '',
        text,
        imageUrl,
        createdAt: serverTimestamp(),
        likes: 0
      });

      // Ganha 10 pontos por postar!
      if (user?.uid) {
        await updateDoc(doc(db, 'usuarios', user.uid), {
          pontos: increment(10)
        });
      }

      setText('');
      setImage(null);
      setPreview('');
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao postar. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-[#1a1a1a] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 border-t border-white/10">
        <div className="flex justify-between mb-4">
          <h2 className="text-xl font-bold">Novo Post</h2>
          <button onClick={onClose}><X /></button>
        </div>
        
        <textarea 
          value={text} 
          onChange={e => setText(e.target.value)}
          placeholder="O que está acontecendo?"
          className="w-full bg-transparent border-none outline-none text-lg resize-none h-32 text-white"
        />

        {preview && (
          <div className="relative w-full h-48 mb-4 rounded-xl overflow-hidden">
            <img src={preview} className="w-full h-full object-cover" alt="" />
            <button onClick={() => {setImage(null); setPreview('');}} className="absolute top-2 right-2 bg-black/50 p-1 rounded-full"><X size={16}/></button>
          </div>
        )}

        <div className="flex justify-between items-center border-t border-white/10 pt-4">
          <label className="cursor-pointer p-2 bg-white/5 rounded-full">
            <ImageIcon size={24} className="text-[#8b5a2b]" />
            <input type="file" className="hidden" accept="image/*" onChange={e => {
              const file = e.target.files[0];
              if (file) { setImage(file); setPreview(URL.createObjectURL(file)); }
            }} />
          </label>
          
          <button 
            onClick={handlePost}
            disabled={loading || (!text && !image)}
            className="bg-[#8b5a2b] px-6 py-2 rounded-full font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> Postar</>}
          </button>
        </div>
      </div>
    </div>
  );
}
