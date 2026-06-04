import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (provider: 'google' | 'facebook') => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
      });
      if (error) throw error;
    } catch (error: any) {
      alert(error.error_description || error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h1 className="mb-6 text-2xl font-bold text-center">ChatX-AI</h1>
        <p className="mb-6 text-center text-gray-600">Đăng nhập để bắt đầu</p>
        
        <button
          onClick={() => handleLogin('google')}
          disabled={loading}
          className="w-full py-2 mb-4 font-bold text-white bg-red-500 rounded hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? 'Đang tải...' : 'Đăng nhập với Google'}
        </button>
        
        <button
          onClick={() => handleLogin('facebook')}
          disabled={loading}
          className="w-full py-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Đang tải...' : 'Đăng nhập với Facebook'}
        </button>

        <div className="mt-6 text-sm text-center text-gray-500">
          Chưa có tài khoản? Hệ thống sẽ tự động tạo cho bạn.
        </div>
      </div>
    </div>
  );
}
