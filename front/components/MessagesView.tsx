
import React, { useState, useRef, useEffect } from 'react';
import { Search, Send, ChevronLeft, MoreVertical, Plus, User, Clock, Check, CheckCheck, Loader2, MessageSquare, Trash2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User as UserType, Conversation, Message } from '../types';
import { api } from '../services';
import { toast } from './Toast';

interface MessagesViewProps {
  currentUser: UserType | null;
  initialTarget?: UserType | null;
  onBack: () => void;
}

interface ConversationWithUser {
  id: string;
  participant: UserType;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  messages: Message[];
  otherUserId: string;
}

export const MessagesView: React.FC<MessagesViewProps> = ({ currentUser, initialTarget, onBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [targetUser, setTargetUser] = useState<UserType | null>(initialTarget || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isConversationsLoaded, setIsConversationsLoaded] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 从 location state 获取目标用户
  const locationTargetUser = (location.state as { targetUser?: UserType })?.targetUser;

  const activeConv = conversations.find(c => c.id === activeConversationId);

  // 获取对话列表
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const data = await api.interactions?.getConversations?.();
        if (data && Array.isArray(data)) {
          // 转换后端数据为前端格式
          const formattedConvs: ConversationWithUser[] = await Promise.all(
            data.map(async (conv: any) => {
              // 获取对方用户信息
              const otherUserId = conv._id; // _id 就是对方的 userId
              let userData = null;
              
              if (otherUserId) {
                // 首先尝试用 userId 获取
                try {
                  userData = await api.auth?.getUserById?.(otherUserId);
                  // 如果返回错误，尝试用 handle 获取
                  if (userData && userData.error) {
                    userData = null;
                    try {
                      userData = await api.auth?.getUserByHandle?.(otherUserId);
                      if (userData && userData.error) {
                        userData = null;
                      }
                    } catch (e) {
                      console.error('Failed to fetch user by handle:', otherUserId, e);
                    }
                  }
                } catch (e) {
                  console.error('Failed to fetch user by id:', otherUserId, e);
                  // 尝试用 handle 获取
                  try {
                    userData = await api.auth?.getUserByHandle?.(otherUserId);
                    if (userData && userData.error) {
                      userData = null;
                    }
                  } catch (e2) {
                    console.error('Failed to fetch user by handle:', otherUserId, e2);
                  }
                }
              }
              
              return {
                id: otherUserId,
                participant: userData ? {
                  _id: userData._id,
                  userId: userData._id,
                  name: userData.name || '未知用户',
                  handle: userData.handle || otherUserId,
                  bio: userData.bio || ''
                } : { 
                  _id: otherUserId,
                  userId: otherUserId,
                  name: otherUserId.length > 10 ? otherUserId.substring(0, 10) + '...' : otherUserId, 
                  handle: otherUserId,
                  bio: '' 
                },
                lastMessage: conv.lastMessage?.content || '暂无消息',
                timestamp: formatTimestamp(conv.lastMessage?.createdAt || conv.updatedAt),
                unreadCount: conv.unreadCount || 0,
                messages: [],
                otherUserId: otherUserId
              };
            })
          );
          setConversations(formattedConvs);
        }
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setIsConversationsLoaded(true);
      }
    };

    if (currentUser) {
      fetchConversations();
    } else {
      setIsConversationsLoaded(true);
    }
  }, [currentUser]);

  // 从 location state 获取目标用户并激活对话
  useEffect(() => {
    const fetchTargetUserAndActivate = async () => {
      if (!locationTargetUser || !isConversationsLoaded) return;
      
      const targetHandle = locationTargetUser.handle;
      
      try {
        // 先尝试在已有对话中查找
        const existing = conversations.find(c => c.participant.handle === targetHandle);
        if (existing) {
          setActiveConversationId(existing.id);
          // 加载该对话的消息
          loadMessages(existing.otherUserId);
          // 清除 location state
          navigate('/messages', { replace: true, state: {} });
          return;
        }
        
        // 如果没有找到，使用 location state 中的用户信息创建临时对话
        const targetUserData = locationTargetUser;
        
        setTargetUser(targetUserData);
        
        // 创建临时对话
        const newConv: ConversationWithUser = {
          id: 'temp-' + Date.now(),
          participant: targetUserData,
          lastMessage: '开启新的对话...',
          timestamp: '刚才',
          unreadCount: 0,
          messages: [],
          otherUserId: targetUserData._id || targetUserData.userId || ''
        };
        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
        
        // 清除 location state
        navigate('/messages', { replace: true, state: {} });
      } catch (error) {
        console.error('Failed to activate conversation:', error);
      }
    };

    fetchTargetUserAndActivate();
  }, [locationTargetUser, isConversationsLoaded, conversations]);

  // 处理 props 传入的 initialTarget
  useEffect(() => {
    if (initialTarget && isConversationsLoaded) {
      const existing = conversations.find(c => c.participant.handle === initialTarget.handle);
      if (existing) {
        setActiveConversationId(existing.id);
        loadMessages(existing.otherUserId);
      } else {
        // 创建临时对话
        const newConv: ConversationWithUser = {
          id: 'temp-' + Date.now(),
          participant: initialTarget,
          lastMessage: '开启新的对话...',
          timestamp: '刚才',
          unreadCount: 0,
          messages: [],
          otherUserId: initialTarget._id || initialTarget.userId || ''
        };
        setConversations(prev => [newConv, ...prev]);
        setActiveConversationId(newConv.id);
      }
    }
  }, [initialTarget, isConversationsLoaded]);

  // 加载消息列表
  const loadMessages = async (otherUserId: string) => {
    if (!otherUserId) return;
    setIsLoading(true);
    try {
      const messages = await api.interactions?.getMessages?.(otherUserId, 50);
      if (messages && Array.isArray(messages)) {
        // 转换消息格式
        const formattedMessages: Message[] = messages.map((msg: any) => ({
          id: msg._id || msg.id,
          senderHandle: msg.sender_id === currentUser?.userId ? currentUser?.handle || '' : activeConv?.participant.handle || '',
          text: msg.content,
          timestamp: formatTimestamp(msg.createdAt),
          isRead: msg.is_read
        })).reverse(); // 按时间正序排列

        setConversations(prev => prev.map(c => 
          c.otherUserId === otherUserId 
            ? { ...c, messages: formattedMessages }
            : c
        ));
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 当切换对话时加载消息
  useEffect(() => {
    if (activeConv && activeConv.messages.length === 0 && activeConv.otherUserId) {
      loadMessages(activeConv.otherUserId);
    }
  }, [activeConversationId]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

  // 发送消息
  const handleSendMessage = async () => {
    if (!draft.trim() || !activeConversationId || !activeConv) return;
    
    const content = draft.trim();
    const tempId = 'temp-' + Date.now();
    
    // 乐观更新 UI
    const newMessage: Message = {
      id: tempId,
      senderHandle: currentUser?.handle || '',
      text: content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setConversations(prev => prev.map(c => 
      c.id === activeConversationId 
        ? { ...c, messages: [...c.messages, newMessage], lastMessage: content, timestamp: '刚才' }
        : c
    ));
    setDraft('');

    // 发送到后端
    if (activeConv.otherUserId) {
      setIsSending(true);
      try {
        await api.interactions?.sendMessage?.(activeConv.otherUserId, content);
      } catch (error) {
        console.error('Failed to send message:', error);
        toast.error('发送失败，请稍后重试');
      } finally {
        setIsSending(false);
      }
    }
  };

  // 删除对话
  const handleDeleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();

    if (!confirm('确定要删除这个对话吗？此操作不会删除消息记录。')) {
      return;
    }

    setDeletingConversationId(convId);
    try {
      // 这里应该调用后端 API 删除对话
      // 目前只是从前端移除
      setConversations(prev => prev.filter(c => c.id !== convId));

      // 如果删除的是当前激活的对话，清空激活状态
      if (activeConversationId === convId) {
        setActiveConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast.error('删除失败，请稍后重试');
    } finally {
      setDeletingConversationId(null);
    }
  };

  // 格式化时间戳
  const formatTimestamp = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex-grow flex h-full bg-[#1e1e1e] overflow-hidden select-none animate-in fade-in duration-300">
      {/* 1. 左侧对话列表 */}
      <aside className="w-80 border-r border-[#2e2e2e] bg-[#181818] flex flex-col shrink-0">
        <div className="p-6 border-b border-[#2e2e2e] flex items-center justify-between">
           <div className="flex items-center gap-3">
             <button 
               onClick={onBack}
               className="p-2 text-gray-500 hover:text-gray-300 hover:bg-[#252525] rounded-xl transition-all"
             >
               <ChevronLeft className="w-5 h-5" />
             </button>
             <h2 className="text-xl font-black text-white flex items-center gap-3">
               <MessageSquare className="w-5 h-5 text-[#f9c132]" />
               私信中心
             </h2>
           </div>
           <button className="p-2 bg-[#252525] rounded-xl hover:bg-[#333] transition-colors"><Plus className="w-4 h-4 text-gray-400" /></button>
        </div>

        <div className="p-4">
           <div className="relative group">
              <input 
                type="text" 
                placeholder="搜索联系人..." 
                className="w-full bg-[#141414] border border-[#2e2e2e] rounded-xl pl-10 pr-4 py-2 text-xs text-gray-300 focus:outline-none focus:border-[#f9c132]/50 transition-all"
              />
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-gray-600 group-focus-within:text-[#f9c132]/50" />
           </div>
        </div>

        <div className="flex-grow overflow-y-auto no-scrollbar">
           {!isConversationsLoaded ? (
             <div className="flex items-center justify-center py-8">
               <Loader2 className="w-6 h-6 text-[#f9c132] animate-spin" />
             </div>
           ) : conversations.length === 0 ? (
             <div className="flex flex-col items-center justify-center p-8 text-gray-500">
               <MessageSquare className="w-12 h-12 mb-4 opacity-30" />
               <p className="text-sm">暂无对话</p>
               <p className="text-xs mt-1">去社区找到志同道合的朋友吧</p>
             </div>
           ) : (
             conversations.map(conv => (
               <div 
                key={conv.id} 
                onClick={() => setActiveConversationId(conv.id)}
                className={`group flex items-center gap-4 px-5 py-4 border-b border-[#2e2e2e]/50 cursor-pointer transition-all ${activeConversationId === conv.id ? 'bg-[#f9c132]/5 border-l-4 border-l-[#f9c132]' : 'hover:bg-[#202020]'}`}
               >
                  <div className="w-12 h-12 rounded-2xl bg-[#2a2a2a] border border-[#3e3e3e] flex items-center justify-center text-lg font-bold text-[#f9c132] shrink-0">
                     {conv.participant.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-grow min-w-0">
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-gray-200 truncate">{conv.participant.name}</span>
                        <span className="text-[10px] text-gray-600 font-bold">{conv.timestamp}</span>
                     </div>
                     <p className="text-xs text-gray-500 truncate leading-relaxed">{conv.lastMessage}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {conv.unreadCount > 0 && (
                      <div className="w-5 h-5 bg-[#f9c132] text-black text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg shadow-[#f9c132]/10">
                        {conv.unreadCount}
                      </div>
                    )}
                    {/* 删除按钮 */}
                    <button
                      onClick={(e) => handleDeleteConversation(e, conv.id)}
                      disabled={deletingConversationId === conv.id}
                      className={`p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                        deletingConversationId === conv.id 
                          ? 'text-gray-600 cursor-not-allowed' 
                          : 'text-gray-500 hover:text-red-400 hover:bg-red-400/10'
                      }`}
                      title="删除对话"
                    >
                      {deletingConversationId === conv.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
               </div>
             ))
           )}
        </div>
      </aside>

      {/* 2. 主聊天区域 */}
      <main className="flex-grow flex flex-col bg-[#1c1c1c] overflow-hidden">
        {activeConv ? (
          <>
            {/* 聊天顶部栏 */}
            <div className="h-16 border-b border-[#2e2e2e] bg-[#1a1a1a]/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#252525] border border-[#3e3e3e] flex items-center justify-center font-bold text-[#f9c132]">
                    {activeConv.participant.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-100">{activeConv.participant.name}</div>
                    <div className="text-[10px] text-gray-600 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500" /> 在线</div>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <button className="p-2.5 text-gray-500 hover:text-gray-200 transition-colors"><Search className="w-4 h-4" /></button>
                  <button className="p-2.5 text-gray-500 hover:text-gray-200 transition-colors"><MoreVertical className="w-4 h-4" /></button>
               </div>
            </div>

            {/* 消息历史 */}
            <div className="flex-grow overflow-y-auto no-scrollbar p-8 space-y-6">
               <div className="text-center py-4">
                  <span className="text-[10px] font-bold text-gray-600 bg-[#252525] px-3 py-1 rounded-full uppercase tracking-widest border border-[#333]">研习频道加密中</span>
               </div>
               
               {isLoading ? (
                 <div className="flex items-center justify-center py-8">
                   <Loader2 className="w-6 h-6 text-[#f9c132] animate-spin" />
                 </div>
               ) : (
                 <>
                   {activeConv.messages.map((msg) => {
                     const isMine = msg.senderHandle === currentUser?.handle;
                     return (
                       <div key={msg.id} className={`flex gap-4 ${isMine ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${isMine ? 'bg-[#3d3d3d] border-[#4e4e4e]' : 'bg-[#2a2a2a] border-[#3e3e3e]'}`}>
                             <User className={`w-4 h-4 ${isMine ? 'text-gray-400' : 'text-[#f9c132]'}`} />
                          </div>
                          <div className={`max-w-[70%] space-y-1 ${isMine ? 'items-end' : ''}`}>
                             <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-xl ${
                                isMine 
                                ? 'bg-[#f9c132] text-black font-medium rounded-tr-none' 
                                : 'bg-[#252525] text-gray-200 border border-[#333] rounded-tl-none'
                             }`}>
                                {msg.text}
                             </div>
                             <div className={`flex items-center gap-2 text-[10px] text-gray-600 px-1 font-bold ${isMine ? 'flex-row-reverse' : ''}`}>
                                <span>{msg.timestamp}</span>
                                {isMine && <CheckCheck className="w-3 h-3 text-[#f9c132]" />}
                             </div>
                          </div>
                       </div>
                     );
                   })}
                 </>
               )}
               <div ref={messagesEndRef} />
            </div>

            {/* 底部输入框 */}
            <div className="p-6 border-t border-[#2e2e2e] bg-[#1a1a1a]">
               <div className="relative group">
                  <textarea 
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder={`发送私信给 ${activeConv.participant.name}...`}
                    className="w-full bg-[#141414] border border-[#2e2e2e] rounded-2xl p-5 pr-14 text-sm text-gray-300 focus:outline-none focus:border-[#f9c132]/50 h-28 resize-none shadow-inner transition-all placeholder:text-gray-700"
                  />
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <button className="p-2 text-gray-500 hover:text-white transition-colors"><Plus className="w-5 h-5" /></button>
                    <button 
                      onClick={handleSendMessage}
                      disabled={!draft.trim() || isSending}
                      className={`p-3 rounded-xl transition-all shadow-lg active:scale-90 ${
                        !draft.trim() || isSending
                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                        : 'bg-[#f9c132] hover:bg-[#ffcf56] text-black'
                      }`}
                    >
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
               </div>
               <div className="mt-3 flex items-center justify-between text-[10px] text-gray-600 font-bold uppercase tracking-widest px-2">
                  <div className="flex gap-4">
                     <span className="flex items-center gap-1 hover:text-[#f9c132] cursor-pointer"><Check className="w-3 h-3" /> 已开启回执</span>
                     <span className="flex items-center gap-1 hover:text-[#f9c132] cursor-pointer">快捷短语</span>
                  </div>
                  <span>Shift + Enter 换行</span>
               </div>
            </div>
          </>
        ) : (
          <div className="flex-grow flex flex-col items-center justify-center p-8 opacity-20 select-none">
             <div className="w-32 h-32 rounded-full border-4 border-dashed border-[#f9c132] flex items-center justify-center mb-8">
                <MessageSquare className="w-16 h-16 text-[#f9c132]" />
             </div>
             <h3 className="text-2xl font-black text-white mb-2">选择一位研习同道</h3>
             <p className="text-sm font-bold text-gray-400">开启深度的学术交流与协作</p>
          </div>
        )}
      </main>
    </div>
  );
};
