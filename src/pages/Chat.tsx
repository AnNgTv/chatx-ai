import { useState, useEffect, useRef } from 'react';
import { supabase, uploadFile } from '../lib/supabase';
import { io } from 'socket.io-client';
import { Send, Image as ImageIcon, MapPin, WifiOff, Bot, User as UserIcon, Sparkles, X, File as FileIcon, Palette } from 'lucide-react';
import { useOnline } from '../hooks/useOnline';
import { saveMessage, getMessages } from '../lib/db';
import axios from 'axios';

const socket = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:3001');

const AI_MODELS = [
  { id: 'gemini', name: 'Gemini 1.5 Flash' },
  { id: 'gpt-4o', name: 'ChatGPT 4o' },
  { id: 'claude', name: 'Claude 3.5 Sonnet' },
  { id: 'grok', name: 'Grok Beta' },
  { id: 'ollama', name: 'Ollama (Llama 3)' },
];

const WALLPAPERS = [
  { id: 'none', name: 'Mặc định', class: 'bg-slate-50' },
  { id: 'sky', name: 'Bầu trời', class: 'bg-sky-50' },
  { id: 'emerald', name: 'Lục bảo', class: 'bg-emerald-50' },
  { id: 'rose', name: 'Hoa hồng', class: 'bg-rose-50' },
  { id: 'dark', name: 'Tối', class: 'bg-slate-900 text-white' },
];

export default function Chat() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [user, setUser] = useState<any>(null);
  const [selectedAI, setSelectedAI] = useState('gemini');
  const [isAIMode, setIsAIMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [wallpaper, setWallpaper] = useState('none');
  const [showSettings, setShowSettings] = useState(false);
  
  const isOnline = useOnline();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMessages().then(setMessages);
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    
    const savedWallpaper = localStorage.getItem('chatx-wallpaper');
    if (savedWallpaper) setWallpaper(savedWallpaper);

    socket.on('receive-message', async (message) => {
      await saveMessage({ ...message, status: 'sent' });
      setMessages((prev) => [...prev, message]);
    });

    return () => { socket.off('receive-message'); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleWallpaperChange = (id: string) => {
    setWallpaper(id);
    localStorage.setItem('chatx-wallpaper', id);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedFile) return;

    let fileUrl = null;
    let fileType = null;

    if (selectedFile) {
      setUploading(true);
      try {
        fileUrl = await uploadFile(selectedFile);
        fileType = selectedFile.type;
      } catch (error: any) {
        alert('Lỗi tải file: ' + (error.message || 'Unknown error'));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const messageData = {
      id: Date.now().toString(),
      text: input,
      sender: user?.email || 'Anonymous',
      timestamp: new Date().toISOString(),
      status: isOnline ? 'sent' : 'pending',
      isAI: false,
      fileUrl,
      fileType,
    };

    if (isOnline) {
      socket.emit('send-message', messageData);
      if (isAIMode && input.trim()) {
        handleAIResponse(input);
      }
    }

    await saveMessage(messageData);
    setMessages((prev) => [...prev, messageData]);
    setInput('');
    setSelectedFile(null);
    setPreview(null);
  };

  const handleAIResponse = async (userMessage: string) => {
    setIsTyping(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}/api/ai/chat`, {
        model: selectedAI,
        message: userMessage,
      });

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        text: response.data.response,
        sender: `AI: ${selectedAI.toUpperCase()}`,
        timestamp: new Date().toISOString(),
        status: 'sent',
        isAI: true,
      };

      await saveMessage(aiMessage);
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI Error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const shareLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        
        const messageData = {
          id: Date.now().toString(),
          text: `Vị trí của tôi: ${mapUrl}`,
          sender: user?.email || 'Anonymous',
          timestamp: new Date().toISOString(),
          status: isOnline ? 'sent' : 'pending',
          isAI: false,
          location: { latitude, longitude }
        };

        if (isOnline) socket.emit('send-message', messageData);
        await saveMessage(messageData);
        setMessages((prev) => [...prev, messageData]);
      });
    } else {
      alert("Trình duyệt không hỗ trợ định vị");
    }
  };

  const currentWallpaperClass = WALLPAPERS.find(w => w.id === wallpaper)?.class || 'bg-slate-50';

  return (
    <div className={`flex flex-col h-screen ${currentWallpaperClass} transition-colors duration-500 font-sans`}>
      {/* Header */}
      <header className={`flex items-center justify-between p-4 ${wallpaper === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm border-b sticky top-0 z-10`}>
        <div className="flex items-center space-x-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className={`text-lg font-bold leading-tight ${wallpaper === 'dark' ? 'text-white' : 'text-slate-900'}`}>ChatX-AI</h1>
            {!isOnline && <div className="flex items-center text-[10px] text-red-500 font-bold uppercase"><WifiOff size={10} className="mr-1" /> Ngoại tuyến</div>}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className={`hidden md:flex items-center ${wallpaper === 'dark' ? 'bg-slate-700' : 'bg-slate-100'} rounded-lg p-1`}>
            {AI_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedAI(m.id)}
                className={`px-3 py-1 text-xs rounded-md transition-all ${selectedAI === m.id ? 'bg-white shadow-sm font-bold text-blue-600' : (wallpaper === 'dark' ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}
              >
                {m.name.split(' ')[0]}
              </button>
            ))}
          </div>
          <button 
            onClick={() => setIsAIMode(!isAIMode)}
            className={`p-2 rounded-full transition-all ${isAIMode ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-600' : (wallpaper === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500')}`}
          >
            <Bot size={20} />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full ${wallpaper === 'dark' ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
          >
            <Palette size={20} />
          </button>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="ml-2 text-xs font-bold px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Settings Overlay */}
      {showSettings && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Cài đặt giao diện</h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Hình nền</p>
              <div className="grid grid-cols-2 gap-3">
                {WALLPAPERS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => handleWallpaperChange(w.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-sm font-medium ${wallpaper === w.id ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-slate-100 hover:border-slate-200 text-slate-600'}`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              onClick={() => setShowSettings(false)}
              className="w-full mt-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all"
            >
              Lưu thay đổi
            </button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === user?.email ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex flex-col max-w-[85%] md:max-w-[70%] ${msg.sender === user?.email ? 'items-end' : 'items-start'}`}>
                <div className={`flex items-center mb-1 space-x-2 ${msg.sender === user?.email ? 'flex-row-reverse' : ''}`}>
                  <div className={`p-1 rounded-full ${msg.isAI ? 'bg-purple-100 text-purple-600' : (wallpaper === 'dark' ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-600')}`}>
                    {msg.isAI ? <Bot size={12} /> : <UserIcon size={12} />}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${wallpaper === 'dark' ? 'text-slate-400' : 'text-slate-400'}`}>{msg.sender === user?.email ? 'Bạn' : msg.sender}</span>
                </div>
                
                <div className={`p-3.5 rounded-2xl shadow-sm text-sm leading-relaxed ${
                  msg.sender === user?.email ? 'bg-blue-600 text-white rounded-tr-none' : msg.isAI ? (wallpaper === 'dark' ? 'bg-slate-800 border border-purple-900/50 text-slate-200 rounded-tl-none ring-1 ring-purple-900/20' : 'bg-white border border-purple-100 text-slate-800 rounded-tl-none ring-1 ring-purple-50') : (wallpaper === 'dark' ? 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none')
                }`}>
                  {msg.fileUrl && (
                    <div className="mb-2">
                      {msg.fileType?.startsWith('image/') ? (
                        <img src={msg.fileUrl} alt="uploaded" className="max-w-full rounded-lg shadow-sm" />
                      ) : (
                        <a href={msg.fileUrl} target="_blank" rel="noreferrer" className={`flex items-center p-2 rounded-lg border text-blue-600 hover:underline ${wallpaper === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                          <FileIcon size={20} className="mr-2" /> Tải về tệp tin
                        </a>
                      )}
                    </div>
                  )}
                  {msg.text && <p>{msg.text}</p>}
                </div>
                
                <div className="flex items-center mt-1.5 space-x-1">
                  <span className="text-[9px] text-slate-400 font-medium">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.status === 'pending' && <span className="text-[9px] text-amber-500 font-bold">● Đang chờ</span>}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start items-start space-x-2">
              <div className="p-1 rounded-full bg-purple-100 text-purple-600"><Bot size={12} /></div>
              <div className={`${wallpaper === 'dark' ? 'bg-slate-800 border-purple-900/50' : 'bg-white border-purple-100'} border p-3 rounded-2xl rounded-tl-none shadow-sm flex space-x-1`}>
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className={`p-4 border-t ${wallpaper === 'dark' ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="max-w-4xl mx-auto">
          {preview && (
            <div className="mb-4 relative inline-block">
              <img src={preview} alt="preview" className="h-20 w-20 object-cover rounded-lg border border-slate-200 shadow-xl" />
              <button onClick={() => {setPreview(null); setSelectedFile(null);}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-all"><X size={12} /></button>
            </div>
          )}
          {selectedFile && !preview && (
            <div className={`mb-4 flex items-center p-2 rounded-lg border ${wallpaper === 'dark' ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
              <FileIcon size={20} className="mr-2 text-slate-500" />
              <span className={`text-xs truncate flex-1 ${wallpaper === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>{selectedFile.name}</span>
              <button onClick={() => setSelectedFile(null)} className="text-red-500 hover:text-red-600"><X size={16} /></button>
            </div>
          )}
          
          <form onSubmit={sendMessage} className={`flex items-center space-x-2 p-2 rounded-2xl border transition-all ${wallpaper === 'dark' ? 'bg-slate-900 border-slate-700 focus-within:ring-blue-500/30' : 'bg-slate-50 border-slate-200 focus-within:ring-blue-500/20'} focus-within:ring-2 focus-within:border-blue-500`}>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:bg-white hover:text-blue-600 rounded-xl transition-all">
              <ImageIcon size={20} />
            </button>
            <button type="button" onClick={shareLocation} className="p-2 text-slate-400 hover:bg-white hover:text-blue-600 rounded-xl transition-all">
              <MapPin size={20} />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isOnline ? (isAIMode ? `Hỏi ${selectedAI}...` : "Nhập tin nhắn...") : "Đang ngoại tuyến..."}
              disabled={!isOnline || uploading}
              className={`flex-1 p-2 bg-transparent focus:outline-none text-sm placeholder:text-slate-400 ${wallpaper === 'dark' ? 'text-white' : 'text-slate-900'}`}
            />
            <button 
              type="submit"
              disabled={(!input.trim() && !selectedFile) || !isOnline || uploading}
              className={`p-2 rounded-xl transition-all ${ (input.trim() || selectedFile) && isOnline ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-200 text-slate-400'}`}
            >
              {uploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Send size={20} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
