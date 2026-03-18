
import React, { useState } from 'react';
import { HelpCircle, Send, BookOpen, MessageSquare, ChevronLeft, Globe, ShieldQuestion } from 'lucide-react';

interface FeedbackViewProps {
  onBack: () => void;
}

export const FeedbackView: React.FC<FeedbackViewProps> = ({ onBack }) => {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="flex-grow flex flex-col h-full bg-[#1e1e1e] overflow-y-auto animate-in fade-in duration-300">
      <div className="max-w-4xl mx-auto w-full px-8 py-12">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-300 mb-10 transition-colors group"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">返回工作台</span>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-12">
          <div className="space-y-8">
            <header>
              <div className="flex items-center gap-3 text-[#f9c132] mb-3">
                <ShieldQuestion className="w-8 h-8" />
                <span className="text-sm font-bold tracking-widest uppercase">Support & Feedback</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-100">反馈中心</h1>
              <p className="text-gray-500 mt-2">您的每一次反馈都让这个项目更加完善。</p>
            </header>

            {submitted ? (
              <div className="bg-[#f9c132]/10 border border-[#f9c132]/40 rounded-xl p-8 text-center animate-in zoom-in">
                <Send className="w-12 h-12 text-[#f9c132] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[#f9c132]">提交成功</h3>
                <p className="text-xs text-gray-400 mt-2">感谢您的反馈，我们的管理员（Rhinox）将尽快处理。</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-8 space-y-6 shadow-xl">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">反馈类型</label>
                  <select className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-[#f9c132]">
                    <option>功能建议</option>
                    <option>界面 Bug</option>
                    <option>资源缺少</option>
                    <option>其他</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase">详细描述</label>
                  <textarea 
                    placeholder="请尽量描述清晰问题或建议的场景..."
                    className="w-full bg-[#141414] border border-[#2e2e2e] rounded-lg px-4 py-3 text-sm text-gray-300 h-40 focus:outline-none focus:border-[#f9c132] resize-none"
                    required
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-[#f9c132] hover:bg-[#ffcf56] text-black font-bold py-3 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  提交反馈
                </button>
              </form>
            )}
          </div>

          <aside className="space-y-6">
            <div className="bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl p-6">
               <h3 className="text-sm font-bold text-gray-200 mb-6 flex items-center gap-2">
                 <BookOpen className="w-4 h-4 text-[#f9c132]" />
                 资源与文档
               </h3>
               <div className="space-y-4">
                  <a href="#" className="flex items-center justify-between group">
                    <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">使用说明文档</span>
                    <Globe className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#f9c132]" />
                  </a>
                  <a href="#" className="flex items-center justify-between group">
                    <span className="text-xs text-gray-400 group-hover:text-gray-200 transition-colors">加入开发者社区</span>
                    <Globe className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#f9c132]" />
                  </a>
               </div>
            </div>

            <div className="bg-[#f9c132]/5 border border-[#f9c132]/20 rounded-xl p-6">
               <h3 className="text-sm font-bold text-[#f9c132] mb-3 flex items-center gap-2">
                 <MessageSquare className="w-4 h-4" />
                 直连管理员
               </h3>
               <p className="text-[11px] text-gray-500 leading-relaxed">
                 如果您遇到紧急的账户权限问题，请直接邮件联系：<br/>
                 <span className="text-gray-300 select-all">563146279@qq.com</span>
               </p>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
};
