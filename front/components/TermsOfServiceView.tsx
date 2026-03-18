import React from 'react';
import { ArrowLeft, FileText, Shield, AlertCircle } from 'lucide-react';

interface TermsOfServiceViewProps {
  onBack: () => void;
}

export const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({ onBack }) => {
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
          <div className="w-16 h-16 bg-[#f9c132]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-[#f9c132]" />
          </div>
          <h1 className="text-4xl font-bold mb-4">使用条款</h1>
          <p className="text-gray-400">最后更新日期：2026年2月12日</p>
        </div>

        {/* 重要提示 */}
        <div className="bg-[#f9c132]/5 border border-[#f9c132]/20 rounded-xl p-6 mb-12">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-[#f9c132] flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-[#f9c132] mb-2">重要提示</h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                在使用 Vaulhub 平台（以下简称"本平台"）之前，请仔细阅读以下使用条款。
                访问或使用本平台即表示您同意受这些条款的约束。如果您不同意这些条款，请不要使用本平台。
              </p>
            </div>
          </div>
        </div>

        {/* 条款内容 */}
        <div className="space-y-12">
          {/* 1. 服务描述 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">1.</span>
              服务描述
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>
                Vaulhub 是一个中医知识管理与协作平台，为用户提供以下服务：
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>个人知识库的创建、管理和分享</li>
                <li>中医笔记的编写、编辑和存储</li>
                <li>社区资源的浏览、下载和互动</li>
                <li>知识图谱的生成和可视化</li>
                <li>用户间的协作和交流功能</li>
              </ul>
            </div>
          </section>

          {/* 2. 用户账户 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">2.</span>
              用户账户
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>
                <strong className="text-gray-300">2.1 账户注册：</strong>
                使用本平台的部分功能需要注册账户。您同意提供准确、完整和最新的注册信息。
              </p>
              <p>
                <strong className="text-gray-300">2.2 账户安全：</strong>
                您有责任保护自己的账户密码安全，并对您账户下的所有活动负责。如发现未经授权使用您的账户，请立即通知我们。
              </p>
              <p>
                <strong className="text-gray-300">2.3 账户终止：</strong>
                我们保留在任何时候，因任何原因，包括但不限于违反本条款，终止或暂停您账户的权利。
              </p>
            </div>
          </section>

          {/* 3. 用户内容 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">3.</span>
              用户内容
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>
                <strong className="text-gray-300">3.1 内容所有权：</strong>
                您保留对您在本平台上创建和发布内容的所有权。通过发布内容，您授予我们非独占的、全球性的、免版税的许可，以使用、复制、修改和展示该内容，仅用于提供和改进我们的服务。
              </p>
              <p>
                <strong className="text-gray-300">3.2 内容规范：</strong>
                您同意不发布以下内容：
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>违法、有害、威胁、辱骂、骚扰、侵权或诽谤性的内容</li>
                <li>侵犯他人知识产权的内容</li>
                <li>未经授权的个人信息或隐私数据</li>
                <li>垃圾邮件、广告或未经请求的推广内容</li>
                <li>恶意软件、病毒或其他有害代码</li>
              </ul>
            </div>
          </section>

          {/* 4. 知识产权 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">4.</span>
              知识产权
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>
                <strong className="text-gray-300">4.1 平台知识产权：</strong>
                本平台及其所有内容（不包括用户内容）、功能和设计均属于 Vaulhub 或其许可方，受版权、商标和其他知识产权法律的保护。
              </p>
              <p>
                <strong className="text-gray-300">4.2 开源组件：</strong>
                本平台使用了多个开源项目，各开源组件的版权归其 respective 所有者所有，并遵循其 respective 的开源协议。
              </p>
            </div>
          </section>

          {/* 5. 免责声明 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">5.</span>
              免责声明
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>
                <strong className="text-gray-300">5.1 服务提供：</strong>
                本平台按"现状"和"可用性"提供，不作出任何明示或暗示的保证。我们不保证服务将不间断、及时、安全或无错误。
              </p>
              <p>
                <strong className="text-gray-300">5.2 医疗免责声明：</strong>
                本平台上分享的中医知识和信息仅供学习和参考，不构成医疗建议。在使用任何中医治疗方法前，请咨询专业医师。
              </p>
              <p>
                <strong className="text-gray-300">5.3 内容准确性：</strong>
                我们不保证平台上用户生成内容的准确性、完整性或可靠性。使用此类内容的风险由您自行承担。
              </p>
            </div>
          </section>

          {/* 6. 责任限制 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">6.</span>
              责任限制
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed">
              <p>
                在法律允许的最大范围内，Vaulhub 及其创始人、员工、代理人对任何间接、附带、特殊、后果性或惩罚性损害不承担责任，
                包括但不限于利润损失、数据丢失、商誉损失或其他无形损失，即使我们已被告知此类损害的可能性。
              </p>
            </div>
          </section>

          {/* 7. 条款修改 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">7.</span>
              条款修改
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed">
              <p>
                我们保留随时修改这些使用条款的权利。修改后的条款将在本页面上发布，并在页面顶部标注更新日期。
                继续使用本平台即表示您接受修改后的条款。建议您定期查看此页面以了解任何更改。
              </p>
            </div>
          </section>

          {/* 8. 联系我们 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">8.</span>
              联系我们
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed">
              <p className="mb-4">
                如果您对这些使用条款有任何疑问，请通过以下方式联系我们：
              </p>
              <div className="flex items-center gap-2 text-gray-300">
                <Shield className="w-4 h-4 text-[#f9c132]" />
                <span>邮箱：admin@obsidian-tcm.com</span>
              </div>
            </div>
          </section>
        </div>

        {/* 同意按钮 */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm mb-6">
            点击"我同意"表示您已阅读并同意以上使用条款
          </p>
          <button
            onClick={onBack}
            className="px-8 py-3 bg-[#f9c132] hover:bg-[#ffcf56] text-black font-bold rounded-lg transition-all"
          >
            我同意
          </button>
        </div>
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

export default TermsOfServiceView;
