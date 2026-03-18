
import React, { useState, useEffect } from 'react';
import { X, User, Lock, Mail, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '../services';

interface LoginViewProps {
  initialMode: 'login' | 'register';
  onLogin: () => void;
  onCancel: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ initialMode, onLogin, onCancel }) => {
  const [isRegistering, setIsRegistering] = useState(initialMode === 'register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Extra field for name if needed

  useEffect(() => {
    setIsRegistering(initialMode === 'register');
    setError(null);
  }, [initialMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let res;
      if (isRegistering) {
        // Assuming name is same as handle for now or add a name field
        res = await api.auth.register({ email, handle, name: handle, password });
      } else {
        // 支持邮箱或用户名(handle)登录：同时提交两个字段，后端择一使用
        const loginPayload: any = { password };
        if (email) loginPayload.email = email;
        if (handle) loginPayload.handle = handle;
        res = await api.auth.login(loginPayload);
      }

      if (res && (res.access_token || res.token)) {
        localStorage.setItem('token', res.access_token || res.token);
        onLogin();
      }
    } catch (err: any) {
      console.error(err);
      setError(isRegistering ? '注册失败，请检查输入或稍后再试' : '登录失败，请检查账号密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center bg-[#1e1e1e] p-8 animate-in fade-in zoom-in duration-300 overflow-y-auto">
      <div className="w-full max-w-sm bg-[#181818] border border-[#2e2e2e] rounded-xl shadow-2xl p-10 relative">
        <button onClick={onCancel} className="absolute top-5 right-5 text-gray-600 hover:text-gray-300 transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-[#252525] border border-[#3e3e3e] rounded-3xl flex items-center justify-center mb-5 shadow-inner">
            <ShieldCheck className="w-10 h-10 text-[#f9c132]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-100 tracking-tight text-center">
            {isRegistering ? '开启中医数字笔记之旅' : '欢迎回来，笔记人'}
          </h2>
          <p className="text-sm text-gray-500 mt-2 font-medium">VaulHub Workspace</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {error && (
             <div className="text-red-500 text-xs text-center bg-red-500/10 p-2 rounded border border-red-500/20">
               {error}
             </div>
          )}

          {isRegistering && (
            <div className="space-y-1.5 animate-in slide-in-from-top duration-200">
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">邮箱地址</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-600" />
                <input 
                  type="email" 
                  placeholder="your@email.com"
                  className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-11 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132] focus:ring-1 focus:ring-[#f9c132]/20 transition-all"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">{isRegistering ? '用户名 (Handle)' : '邮箱地址'}</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-600" />
              <input 
                type={isRegistering ? "text" : "email"} 
                placeholder={isRegistering ? "用户名" : "邮箱地址"}
                className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-11 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132] focus:ring-1 focus:ring-[#f9c132]/20 transition-all"
                required
                value={isRegistering ? handle : email}
                onChange={e => isRegistering ? setHandle(e.target.value) : setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">密码</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-600" />
              <input 
                type="password" 
                placeholder="••••••••"
                className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-11 py-3 text-sm text-gray-200 focus:outline-none focus:border-[#f9c132] focus:ring-1 focus:ring-[#f9c132]/20 transition-all"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-[#f9c132] hover:bg-[#ffcf56] text-black font-bold py-3.5 rounded-lg transition-all shadow-lg active:scale-[0.98] mt-4 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (isRegistering ? '立即注册' : '登 录')}
          </button>
        </form>

        <div className="mt-8 text-center text-xs border-t border-[#2e2e2e] pt-6">
          <span className="text-gray-500">
            {isRegistering ? '已经有账号了？' : "还没有账号？"}
          </span>
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="ml-1.5 text-[#f9c132] hover:text-[#ffcf56] font-bold hover:underline transition-colors"
          >
            {isRegistering ? '去登录' : '创建一个新账号'}
          </button>
        </div>
      </div>
    </div>
  );
};
