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

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNovaFoto(file);
      setPreviewFoto(URL.createObjectURL(file));
    }
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    
    // ATUALIZAÇÃO OTIMISTA: Muda na tela antes de terminar no servidor para não parecer travado
    const dadosAntigos = { ...userData };
    const novosDados = { ...userData, nome, bio, fotoPerfil: previewFoto };
    setUserData(novosDados);

    try {
      let urlFoto = userData.fotoPerfil;

      if (novaFoto) {
        const fotoRef = ref(storage, `perfis/${user.uid}`);
        await uploadBytes(fotoRef, novaFoto);
        urlFoto = await getDownloadURL(fotoRef);
      }

      const userRef = doc(db, 'usuarios', user.uid);
      await updateDoc(userRef, {
        nome: nome,
        bio: bio,
        fotoPerfil: urlFoto,
        updatedAt: new Date().toISOString()
      });

      setUserData({ ...novosDados, fotoPerfil: urlFoto });
      
      setSucesso(true);
      setTimeout(() => {
        router.push('/perfil');
      }, 1500);

    } catch (error) {
      console.error("Erro ao atualizar:", error);
      alert("Erro ao salvar. Tentando reverter...");
      setUserData(dadosAntigos); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#1a1a1a] text-white">
      {/* Header */}
      <div className="p-4 flex items-center gap-4 border-b border-white/10 bg-[#1a1a1a] sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold font-poppins">Editar Perfil</h1>
      </div>

      <form onSubmit={handleSalvar} className="p-6 flex flex-col gap-6">
        {/* Foto */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-24 h-24">
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#8b5a2b]">
              {previewFoto ? (
                <img src={previewFoto} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#333] flex items-center justify-center">
                  <Camera size={32} className="text-white/30" />
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-[#8b5a2b] p-2 rounded-full cursor-pointer shadow-lg">
              <Camera size={18} />
              <input type="file" className="hidden" accept="image/*" onChange={handleFotoChange} />
            </label>
          </div>
          <span className="text-sm text-white/50">Toque no ícone para trocar a foto</span>
        </div>

        {/* Campos */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-white/50 mb-1 block ml-1">Nome Completo</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full bg-[#333] border-none rounded-xl p-4 text-white focus:ring-2 focus:ring-[#8b5a2b] outline-none"
              placeholder="Seu nome"
              required
            />
          </div>

          <div>
            <label className="text-sm text-white/50 mb-1 block ml-1">Bio / Descrição</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-[#333] border-none rounded-xl p-4 text-white focus:ring-2 focus:ring-[#8b5a2b] outline-none h-24 resize-none"
              placeholder="Conte um pouco sobre você..."
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || sucesso}
          className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            sucesso ? 'bg-green-600' : 'bg-[#8b5a2b] active:scale-95'
          } disabled:opacity-70`}
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : sucesso ? (
            <>
              <Check size={20} /> Salvo com sucesso!
            </>
          ) : (
            'Salvar Alterações'
          )}
        </button>
      </form>
    </div>
  );
}
