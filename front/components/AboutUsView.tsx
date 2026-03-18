import React from 'react';
import { ArrowLeft, Heart, Users, Target, Lightbulb } from 'lucide-react';

interface AboutUsViewProps {
  onBack: () => void;
}

export const AboutUsView: React.FC<AboutUsViewProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#1e1e1e] text-gray-100">
      {/* 头部导航 */}
      <header className="sticky top-0 z-50 bg-[#1e1e1e]/80 backdrop-blur-xl border-b border-[#2e2e2e]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">返回</span>
          </button>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* 标题区域 */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">关于我们</h1>
          <p className="text-gray-400 text-lg">传承中医智慧，共建知识社区</p>
        </div>

        {/* 使命愿景 */}
        <section className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-8">
              <div className="w-12 h-12 bg-[#f9c132]/10 rounded-lg flex items-center justify-center mb-4">
                <Target className="w-6 h-6 text-[#f9c132]" />
              </div>
              <h2 className="text-xl font-bold mb-3">我们的使命</h2>
              <p className="text-gray-400 leading-relaxed">
                利用现代技术保护和传承中医知识，让古老的智慧在数字时代焕发新生。
                我们致力于构建一个开放、协作的中医知识管理平台。
              </p>
            </div>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-8">
              <div className="w-12 h-12 bg-[#f9c132]/10 rounded-lg flex items-center justify-center mb-4">
                <Lightbulb className="w-6 h-6 text-[#f9c132]" />
              </div>
              <h2 className="text-xl font-bold mb-3">我们的愿景</h2>
              <p className="text-gray-400 leading-relaxed">
                成为全球领先的中医知识管理与协作平台，连接中医从业者、学者和爱好者，
                推动中医知识的数字化、标准化和国际化传播。
              </p>
            </div>
          </div>
        </section>

        {/* 团队介绍 */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
            <Users className="w-6 h-6 text-[#f9c132]" />
            核心团队
          </h2>
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-[#f9c132] flex items-center justify-center text-black text-2xl font-bold">
                R
              </div>
              <div>
                <h3 className="text-xl font-bold">Rhinox</h3>
                <p className="text-[#f9c132] text-sm mb-2">创始人 & 核心开发者</p>
                <p className="text-gray-400 text-sm leading-relaxed max-w-2xl">
                  热爱中医文化的全栈开发者，致力于用现代技术传承和发扬中医智慧。
                  相信知识的力量，期待与更多志同道合的朋友一起建设这个社区。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 联系我们 */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
            <Heart className="w-6 h-6 text-[#f9c132]" />
            联系我们
          </h2>
          <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">邮箱</h4>
                <p className="text-gray-300">admin@obsidian-tcm.com</p>
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">QQ 群</h4>
                <p className="text-gray-300">123456789</p>
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-500 uppercase mb-2">微信公众号</h4>
                <p className="text-gray-300">TCMWorkbench</p>
              </div>
            </div>
          </div>
        </section>

        {/* 加入我们 */}
        <section className="text-center py-12 bg-[#f9c132]/5 border border-[#f9c132]/20 rounded-xl">
          <h2 className="text-2xl font-bold mb-4">加入我们的社区</h2>
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            无论你是中医从业者、学习者还是技术开发者，都欢迎加入我们的社区，
            一起为中医知识的传承和创新贡献力量。
          </p>
          <button
            onClick={onBack}
            className="px-8 py-3 bg-[#f9c132] hover:bg-[#ffcf56] text-black font-bold rounded-lg transition-all"
          >
            立即加入
          </button>
        </section>
      </main>

      {/* 页脚 */}
      <footer className="border-t border-[#2e2e2e] py-8 mt-16">
        <div className="max-w-4xl mx-auto px-6 text-center text-sm text-gray-500">
          <p>© 2026 Vaulhub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AboutUsView;
