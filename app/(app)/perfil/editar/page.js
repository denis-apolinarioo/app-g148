/* eslint-disable */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ArrowLeft, Camera, Loader2, Check } from 'lucide-react';

export default function EditarPerfil() {
  const { user, userData, setUserData } = useAuth();
  const router = useRouter();
  
  const [nome, setNome] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [novaFoto, setNovaFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');

  useEffect(() => {
    if (userData) {
      setNome(userData.nome || '');
      setBio(userData.bio || '');
      setPreviewFoto(userData.fotoPerfil || '');
    }
  }, [userData]);

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      let urlFoto = userData.fotoPerfil;
      if (novaFoto) {
        const fotoRef = ref(storage, `perfis/${user.uid}`);
        await uploadBytes(fotoRef, novaFoto);
        urlFoto = await getDownloadURL(fotoRef);
      }

      await updateDoc(doc(db, 'usuarios', user.uid), {
        nome, bio, fotoPerfil: urlFoto, updatedAt: new Date().toISOString()
      });

      if (setUserData) setUserData({ ...userData, nome, bio, fotoPerfil: urlFoto });
      setSucesso(true);
      setTimeout(() => router.push('/perfil'), 1500);
    } catch (error) {
      alert("Erro ao salvar. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1a1a] text-white font-poppins">
      <div className="p-4 flex items-center gap-4 border-b border-white/10">
        <button onClick={() => router.back()}><ArrowLeft size={24} /></button>
        <h1 className="text-xl font-bold">Editar Perfil</h1>
      </div>
      <form onSubmit={handleSalvar} className="p-6 flex flex-col gap-6">
        <div className="flex flex-col items-center">
          <div className="relative w-24 h-24 rounded-full border-2 border-[#8b5a2b] overflow-hidden">
            <img src={previewFoto || '/default-avatar.png'} className="w-full h-full object-cover" alt="" />
            <label className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer">
              <Camera size={24} />
              <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                const file = e.target.files[0];
                if (file) { setNovaFoto(file); setPreviewFoto(URL.createObjectURL(file)); }
              }} />
            </label>
          </div>
        </div>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome" className="bg-[#333] p-4 rounded-xl outline-none" required />
        <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio" className="bg-[#333] p-4 rounded-xl h-24 outline-none" />
        <button type="submit" disabled={loading} className="bg-[#8b5a2b] py-4 rounded-xl font-bold flex justify-center">
          {loading ? <Loader2 className="animate-spin" /> : sucesso ? <Check /> : 'Salvar Alterações'}
        </button>
      </form>
    </div>
  );
}
