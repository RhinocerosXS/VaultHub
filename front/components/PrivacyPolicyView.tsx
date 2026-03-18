import React from 'react';
import { ArrowLeft, Lock, Eye, Database, Shield } from 'lucide-react';

interface PrivacyPolicyViewProps {
  onBack: () => void;
}

export const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
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
            <Lock className="w-8 h-8 text-[#f9c132]" />
          </div>
          <h1 className="text-4xl font-bold mb-4">隐私政策</h1>
          <p className="text-gray-400">最后更新日期：2026年2月12日</p>
        </div>

        {/* 引言 */}
        <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-8 mb-12">
          <p className="text-gray-400 leading-relaxed">
            Vaulhub（以下简称"我们"或"本平台"）非常重视用户的隐私保护。本隐私政策说明了我们如何收集、使用、
            存储和保护您的个人信息。使用我们的服务即表示您同意本隐私政策中描述的做法。请仔细阅读以下内容。
          </p>
        </div>

        {/* 政策内容 */}
        <div className="space-y-12">
          {/* 1. 信息收集 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">1.</span>
              我们收集的信息
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>
                <strong className="text-gray-300">1.1 账户信息：</strong>
                当您注册账户时，我们会收集您的用户名、邮箱地址和密码。您还可以选择提供头像、个人简介等可选信息。
              </p>
              <p>
                <strong className="text-gray-300">1.2 用户内容：</strong>
                我们会存储您在本平台上创建、上传或分享的所有内容，包括笔记、知识库、评论、点赞等互动数据。
              </p>
              <p>
                <strong className="text-gray-300">1.3 使用数据：</strong>
                我们会自动收集您如何使用本平台的信息，包括访问时间、浏览页面、点击操作、IP 地址、设备类型和浏览器信息。
              </p>
              <p>
                <strong className="text-gray-300">1.4 Cookie 和类似技术：</strong>
                我们使用 Cookie 和本地存储技术来记住您的登录状态、偏好设置，并改善用户体验。
              </p>
            </div>
          </section>

          {/* 2. 信息使用 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">2.</span>
              我们如何使用您的信息
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>我们使用收集的信息用于以下目的：</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>提供、维护和改进我们的服务</li>
                <li>处理您的注册、登录和账户管理</li>
                <li>存储和展示您创建的内容</li>
                <li>个性化您的使用体验</li>
                <li>向您发送服务通知和更新</li>
                <li>分析使用趋势以优化产品功能</li>
                <li>保护平台安全，防止欺诈和滥用</li>
                <li>遵守法律法规要求</li>
              </ul>
            </div>
          </section>

          {/* 3. 信息共享 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">3.</span>
              信息共享与披露
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>
                <strong className="text-gray-300">3.1 公开信息：</strong>
                您在社区中公开发布的内容（如公开知识库、评论、点赞）将对其他用户可见。请谨慎分享您不希望公开的信息。
              </p>
              <p>
                <strong className="text-gray-300">3.2 第三方服务提供商：</strong>
                我们可能会与可信赖的第三方服务提供商合作，他们协助我们提供服务（如云服务、数据分析）。
                这些提供商仅能在必要的范围内访问您的信息，并受保密义务约束。
              </p>
              <p>
                <strong className="text-gray-300">3.3 法律要求：</strong>
                我们可能会在以下情况下披露您的信息：
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>遵守法律法规或法院命令</li>
                <li>保护我们的权利、财产或安全</li>
                <li>防止欺诈或滥用行为</li>
                <li>在合并、收购或资产出售时转移信息</li>
              </ul>
            </div>
          </section>

          {/* 4. 数据安全 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#f9c132]" />
              <span className="text-[#f9c132]">4.</span>
              数据安全
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>
                我们采取合理的技术和组织措施来保护您的个人信息免受未经授权的访问、使用或披露。这些措施包括：
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>使用加密技术保护数据传输</li>
                <li>实施访问控制和身份验证机制</li>
                <li>定期备份数据以防止丢失</li>
                <li>对员工进行数据安全培训</li>
              </ul>
              <p className="mt-4">
                尽管我们努力保护您的信息，但请注意，互联网传输无法保证 100% 安全。您使用我们的服务即表示您接受这一风险。
              </p>
            </div>
          </section>

          {/* 5. 数据保留 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-[#f9c132]" />
              <span className="text-[#f9c132]">5.</span>
              数据保留
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>
                我们会在您的账户存续期间保留您的个人信息。如果您删除账户，我们将在合理的时间内删除您的个人信息，
                但可能会保留某些信息以遵守法律义务、解决争议或执行我们的协议。
              </p>
              <p>
                公开分享的内容可能会在我们的系统中保留更长时间，即使您删除了账户，
                因为其他用户可能已经复制或引用了这些内容。
              </p>
            </div>
          </section>

          {/* 6. 您的权利 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#f9c132]" />
              <span className="text-[#f9c132]">6.</span>
              您的权利
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed space-y-4">
              <p>根据适用的数据保护法律，您可能拥有以下权利：</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong className="text-gray-300">访问权：</strong> 获取我们持有的关于您的个人信息的副本</li>
                <li><strong className="text-gray-300">更正权：</strong> 更正不准确或不完整的个人信息</li>
                <li><strong className="text-gray-300">删除权：</strong> 要求删除您的个人信息（在某些情况下）</li>
                <li><strong className="text-gray-300">限制处理权：</strong> 限制我们对您个人信息的处理</li>
                <li><strong className="text-gray-300">数据可携带权：</strong> 以结构化格式获取您的数据并传输给其他服务</li>
                <li><strong className="text-gray-300">反对权：</strong> 反对我们处理您的个人信息</li>
              </ul>
              <p className="mt-4">
                要行使这些权利，请通过本政策末尾提供的联系方式与我们联系。
              </p>
            </div>
          </section>

          {/* 7. 儿童隐私 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">7.</span>
              儿童隐私
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed">
              <p>
                我们的服务不面向 13 岁以下的儿童。我们不会故意收集 13 岁以下儿童的个人信息。
                如果您发现我们可能收集了儿童的信息，请立即联系我们，我们将采取措施删除相关信息。
              </p>
            </div>
          </section>

          {/* 8. 政策更新 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">8.</span>
              隐私政策更新
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed">
              <p>
                我们可能会不时更新本隐私政策。更新后的政策将在本页面上发布，并在页面顶部标注更新日期。
                重大变更可能会通过电子邮件或平台通知告知您。继续使用我们的服务即表示您接受更新后的政策。
              </p>
            </div>
          </section>

          {/* 9. 联系我们 */}
          <section>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="text-[#f9c132]">9.</span>
              联系我们
            </h2>
            <div className="bg-[#181818] border border-[#2e2e2e] rounded-xl p-6 text-gray-400 leading-relaxed">
              <p className="mb-4">
                如果您对本隐私政策有任何疑问、担忧或请求，请通过以下方式联系我们：
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#f9c132]" />
                  <span className="text-gray-300">邮箱：privacy@obsidian-tcm.com</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#f9c132]" />
                  <span className="text-gray-300">地址：中国</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 确认按钮 */}
        <div className="mt-16 text-center">
          <p className="text-gray-500 text-sm mb-6">
            点击"我已了解"表示您已阅读并理解本隐私政策
          </p>
          <button
            onClick={onBack}
            className="px-8 py-3 bg-[#f9c132] hover:bg-[#ffcf56] text-black font-bold rounded-lg transition-all"
          >
            我已了解
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

export default PrivacyPolicyView;
