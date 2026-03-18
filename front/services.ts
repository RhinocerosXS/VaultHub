export const API_BASE_URL = 'http://localhost:3001/api';

export const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  auth: {
    register: async (data: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Registration failed');
        return res.json();
      } catch (error) {
        console.error('Registration error:', error);
        throw error;
      }
    },
    login: async (data: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Login failed');
        return res.json();
      } catch (error) {
        console.error('Login error:', error);
        throw error;
      }
    },
    me: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) {
          // 401 表示未登录，静默处理，不抛出错误
          if (res.status === 401) {
            return null;
          }
          throw new Error('Failed to fetch user');
        }
        return res.json();
      } catch (error) {
        // 未登录时不打印错误，避免控制台报错
        if (error instanceof Error && error.message === 'Failed to fetch user') {
          console.error('Fetch user error:', error);
        }
        return null;
      }
    },
    // 获取指定用户的信息（通过 handle，公开接口）
    getUserByHandle: async (handle: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/user/${encodeURIComponent(handle)}`);
        if (!res.ok) throw new Error('Failed to fetch user');
        return res.json();
      } catch (error) {
        console.error('Fetch user by handle error:', error);
        return null;
      }
    },
    // 获取指定用户的信息（通过 userId，需要登录）
    getUserById: async (userId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/user/id/${encodeURIComponent(userId)}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch user by id');
        return res.json();
      } catch (error) {
        console.error('Fetch user by id error:', error);
        return null;
      }
    },
    updateProfile: async (data: { name?: string; bio?: string }) => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/profile`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update profile');
        return res.json();
      } catch (error) {
        console.error('Update profile error:', error);
        throw error;
      }
    },
  },
  vaults: {
    list: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/vaults`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch vaults');
        return res.json();
      } catch (error) {
        console.error('Fetch vaults error:', error);
        // 如果获取知识库列表失败，返回空数组，确保前端功能不会完全崩溃
        return [];
      }
    },
    create: async (data: any) => {
      try {
        console.log('API: Creating vault at:', `${API_BASE_URL}/vaults`);
        console.log('API: Request data:', data);
        const res = await fetch(`${API_BASE_URL}/vaults`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        console.log('API: Response status:', res.status);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('API: Error response:', errorText);
          throw new Error('Failed to create vault');
        }
        return res.json();
      } catch (error) {
        console.error('Create vault error:', error);
        throw error;
      }
    },
    update: async (id: string, data: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/vaults/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update vault');
        return res.json();
      } catch (error) {
        console.error('Update vault error:', error);
        throw error;
      }
    },
    delete: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/vaults/${id}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to delete vault');
        return res.json();
      } catch (error) {
        console.error('Delete vault error:', error);
        throw error;
      }
    },
    getById: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/vaults/${id}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch vault');
        return res.json();
      } catch (error) {
        console.error('Fetch vault error:', error);
        throw error;
      }
    },
    addCollaborator: async (vaultId: string, handle: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/vaults/${vaultId}/collaborators`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ handle }),
        });
        if (!res.ok) throw new Error('Failed to add collaborator');
        return res.json();
      } catch (error) {
        console.error('Add collaborator error:', error);
        throw error;
      }
    },
    removeCollaborator: async (vaultId: string, handle: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/vaults/${vaultId}/collaborators/${handle}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to remove collaborator');
        return res.json();
      } catch (error) {
        console.error('Delete vault error:', error);
        throw error;
      }
    },
  },
  files: {
    getTree: async (vaultId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/files/tree/${vaultId}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch file tree');
        return res.json();
      } catch (error) {
        console.error('Fetch file tree error:', error);
        // 如果获取文件树失败，返回空数组，确保前端功能不会完全崩溃
        return [];
      }
    },
    getContent: async (id: string) => {
      const res = await fetch(`${API_BASE_URL}/files/${id}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch file content');
      
      try {
        // 先获取响应文本，然后再尝试解析 JSON
        const responseText = await res.text();
        // 检查响应文本是否为空
        if (!responseText || responseText.trim() === '') {
          return { content: '' };
        }
        // 尝试解析 JSON
        return JSON.parse(responseText);
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        // 如果 JSON 解析失败，返回一个默认对象
        return { content: '' };
      }
    },
    create: async (data: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create file');
        return res.json();
      } catch (error) {
        console.error('Create file error:', error);
        throw error;
      }
    },
    update: async (id: string, data: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/files/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update file');
        // 检查响应是否有内容
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return res.json();
        }
        return { success: true };
      } catch (error) {
        console.error('Update file error:', error);
        throw error;
      }
    },
    delete: async (id: string) => {
      try {
        const url = `${API_BASE_URL}/files/${id}`;
        const options = {
          method: 'DELETE',
          headers: getAuthHeader(),
        };
        
        console.log('Sending delete request:', url, options);
        
        const res = await fetch(url, options);
        
        console.log('Delete response status:', res.status);
        console.log('Delete response headers:', Object.fromEntries(res.headers.entries()));
        
        if (!res.ok) {
          // 尝试获取错误信息
          let errorMessage = 'Failed to delete file';
          try {
            const errorData = await res.text();
            console.log('Delete error response:', errorData);
            if (errorData) {
              errorMessage = errorData;
            }
          } catch (e) {
            console.error('Failed to parse error response:', e);
          }
          throw new Error(errorMessage);
        }
        
        // 检查响应是否有内容
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const responseData = await res.json();
          console.log('Delete success response:', responseData);
          return responseData;
        }
        
        console.log('Delete success - no JSON response');
        return { success: true };
      } catch (error) {
        console.error('Delete request error:', error);
        throw error;
      }
    },
  },
  interactions: {
    getStarred: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/starred`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch starred files');
        return res.json();
      } catch (error) {
        console.error('Fetch starred files error:', error);
        // 如果获取星标文件失败，返回空数组，确保前端功能不会完全崩溃
        return [];
      }
    },
    toggleStar: async (fileId: string, vaultId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/star`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify({ fileId, vaultId }),
        });
        if (!res.ok) throw new Error('Failed to toggle star');
        return res.json();
      } catch (error) {
        console.error('Toggle star error:', error);
        throw error;
      }
    },
    getComments: async (fileId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/comments/${fileId}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch comments');
        return res.json();
      } catch (error) {
        console.error('Fetch comments error:', error);
        // 如果获取评论失败，返回空数组，确保前端功能不会完全崩溃
        return [];
      }
    },
    addComment: async (data: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to add comment');
        return res.json();
      } catch (error) {
        console.error('Add comment error:', error);
        throw error;
      }
    },
    addReply: async (data: { file_id: string; content: string; parent_id: string; vault_id?: string }) => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to add reply');
        return res.json();
      } catch (error) {
        console.error('Add reply error:', error);
        throw error;
      }
    },
    deleteComment: async (commentId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/comments/${commentId}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to delete comment');
        return res.json();
      } catch (error) {
        console.error('Delete comment error:', error);
        throw error;
      }
    },
    toggleCommentLike: async (commentId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/comments/${commentId}/like`, {
          method: 'POST',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to toggle comment like');
        return res.json();
      } catch (error) {
        console.error('Toggle comment like error:', error);
        throw error;
      }
    },
    getCommentsByVault: async (vaultId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/comments/vault/${vaultId}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) {
          // 401 表示未登录，静默处理
          if (res.status === 401) {
            return [];
          }
          throw new Error('Failed to fetch comments by vault');
        }
        return res.json();
      } catch (error) {
        // 未登录时静默处理
        return [];
      }
    },
    getUserLikes: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/likes`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch user likes');
        return res.json();
      } catch (error) {
        console.error('Fetch user likes error:', error);
        return [];
      }
    },
    getFollowers: async (userId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/followers/${userId}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch followers');
        return res.json();
      } catch (error) {
        console.error('Fetch followers error:', error);
        return [];
      }
    },
    getFollowing: async (userId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/following/${userId}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch following');
        return res.json();
      } catch (error) {
        console.error('Fetch following error:', error);
        return [];
      }
    },
    followUser: async (userId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/follow/${userId}`, {
          method: 'POST',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to follow user');
        return res.json();
      } catch (error) {
        console.error('Follow user error:', error);
        throw error;
      }
    },
    unfollowUser: async (userId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/follow/${userId}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to unfollow user');
        return res.json();
      } catch (error) {
        console.error('Unfollow user error:', error);
        throw error;
      }
    },
    isFollowing: async (userId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/follow/status/${userId}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to check follow status');
        return res.json();
      } catch (error) {
        console.error('Check follow status error:', error);
        return { isFollowing: false };
      }
    },
    getFollowCounts: async (userId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/follow/counts/${userId}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) {
          // 401 表示未登录，静默处理
          if (res.status === 401) {
            return { followersCount: 0, followingCount: 0 };
          }
          throw new Error('Failed to fetch follow counts');
        }
        return res.json();
      } catch (error) {
        // 未登录时静默处理
        return { followersCount: 0, followingCount: 0 };
      }
    },
    hasLiked: async (targetType: string, targetId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/likes/status/${targetType}/${targetId}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) {
          // 401 表示未登录，静默处理
          if (res.status === 401) {
            return { hasLiked: false };
          }
          throw new Error('Failed to check like status');
        }
        return res.json();
      } catch (error) {
        // 未登录时静默处理
        return { hasLiked: false };
      }
    },
    hasFavorited: async (targetType: string, targetId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/favorites/status/${targetType}/${targetId}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) {
          // 401 表示未登录，静默处理
          if (res.status === 401) {
            return { hasFavorited: false };
          }
          throw new Error('Failed to check favorite status');
        }
        return res.json();
      } catch (error) {
        // 未登录时静默处理
        return { hasFavorited: false };
      }
    },
    getLikeCount: async (targetType: string, targetId: string) => {
      try {
        const headers: Record<string, string> = {};
        const token = localStorage.getItem('token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_BASE_URL}/likes/count/${targetType}/${targetId}`, {
          headers,
        });
        if (!res.ok) throw new Error('Failed to get like count');
        return res.json();
      } catch (error) {
        console.error('Get like count error:', error);
        return { count: 0 };
      }
    },
    getFavoriteCount: async (targetType: string, targetId: string) => {
      try {
        const headers: Record<string, string> = {};
        const token = localStorage.getItem('token');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(`${API_BASE_URL}/favorites/count/${targetType}/${targetId}`, {
          headers,
        });
        if (!res.ok) throw new Error('Failed to get favorite count');
        return res.json();
      } catch (error) {
        console.error('Get favorite count error:', error);
        return { count: 0 };
      }
    },
    toggleLike: async (data: { targetType: string; targetId: string }) => {
      try {
        const res = await fetch(`${API_BASE_URL}/likes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to toggle like');
        return res.json();
      } catch (error) {
        console.error('Toggle like error:', error);
        throw error;
      }
    },
    toggleFavorite: async (data: { targetType: string; targetId: string; note?: string }) => {
      try {
        const res = await fetch(`${API_BASE_URL}/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to toggle favorite');
        return res.json();
      } catch (error) {
        console.error('Toggle favorite error:', error);
        throw error;
      }
    },
    getFavorites: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/favorites`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch favorites');
        return res.json();
      } catch (error) {
        console.error('Fetch favorites error:', error);
        return [];
      }
    },
    getBookmarks: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/bookmarks`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch bookmarks');
        return res.json();
      } catch (error) {
        console.error('Fetch bookmarks error:', error);
        return [];
      }
    },
    toggleBookmark: async (fileId: string, vaultId: string, fileName: string, paragraphIndex?: number) => {
      try {
        const res = await fetch(`${API_BASE_URL}/user/bookmarks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ fileId, vaultId, fileName, paragraphIndex }),
        });
        if (!res.ok) throw new Error('Failed to toggle bookmark');
        return res.json();
      } catch (error) {
        console.error('Toggle bookmark error:', error);
        throw error;
      }
    },
    getNotifications: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/notifications`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch notifications');
        return res.json();
      } catch (error) {
        console.error('Fetch notifications error:', error);
        return [];
      }
    },
    markNotificationAsRead: async (notificationId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
          method: 'PATCH',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to mark notification as read');
        return res.json();
      } catch (error) {
        console.error('Mark notification as read error:', error);
        throw error;
      }
    },
    getUnreadNotificationCount: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/notifications/unread/count`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch unread count');
        return res.json();
      } catch (error) {
        console.error('Fetch unread count error:', error);
        return { count: 0 };
      }
    },
    deleteAllNotifications: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/notifications`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to delete all notifications');
        return res.json();
      } catch (error) {
        console.error('Delete all notifications error:', error);
        throw error;
      }
    },
    // ==================== 私信相关 API ====================
    // 获取对话列表
    getConversations: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/conversations`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch conversations');
        return res.json();
      } catch (error) {
        console.error('Fetch conversations error:', error);
        return [];
      }
    },
    // 获取与某用户的消息列表
    getMessages: async (userId: string, limit?: number, skip?: number) => {
      try {
        let url = `${API_BASE_URL}/messages/${userId}`;
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (skip) params.append('skip', skip.toString());
        if (params.toString()) url += `?${params.toString()}`;
        
        const res = await fetch(url, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch messages');
        return res.json();
      } catch (error) {
        console.error('Fetch messages error:', error);
        return [];
      }
    },
    // 发送私信
    sendMessage: async (receiverId: string, content: string, messageType?: string, attachmentUrl?: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ 
            receiverId, 
            content, 
            messageType: messageType || 'text',
            attachmentUrl 
          }),
        });
        if (!res.ok) throw new Error('Failed to send message');
        return res.json();
      } catch (error) {
        console.error('Send message error:', error);
        throw error;
      }
    },
    // 标记消息为已读
    markMessageAsRead: async (messageId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/messages/${messageId}/read`, {
          method: 'PATCH',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to mark message as read');
        return res.json();
      } catch (error) {
        console.error('Mark message as read error:', error);
        throw error;
      }
    },
    // 获取未读消息数
    getUnreadMessageCount: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/messages/unread/count`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch unread count');
        return res.json();
      } catch (error) {
        console.error('Fetch unread message count error:', error);
        return { count: 0 };
      }
    },
    // 点赞（使用 toggleLike 实现）
    like: async (targetType: string, targetId: string) => {
      return api.interactions.toggleLike({ targetType, targetId });
    },
    // 取消点赞（使用 toggleLike 实现）
    unlike: async (targetType: string, targetId: string) => {
      return api.interactions.toggleLike({ targetType, targetId });
    },
    // 收藏（使用 toggleFavorite 实现）
    favorite: async (targetType: string, targetId: string) => {
      return api.interactions.toggleFavorite({ targetType, targetId });
    },
    // 取消收藏（使用 toggleFavorite 实现）
    unfavorite: async (targetType: string, targetId: string) => {
      return api.interactions.toggleFavorite({ targetType, targetId });
    },
    // 关注用户
    follow: async (userId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/follow/${userId}`, {
          method: 'POST',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to follow user');
        return res.json();
      } catch (error) {
        console.error('Follow user error:', error);
        throw error;
      }
    },
    // 取消关注用户
    unfollow: async (userId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/follow/${userId}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to unfollow user');
        return res.json();
      } catch (error) {
        console.error('Unfollow user error:', error);
        throw error;
      }
    },
  },
  ai: {
      chat: async (history: any[]) => {
        try {
          const res = await fetch(`${API_BASE_URL}/ai/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
              body: JSON.stringify({ contents: history }),
          });
          if (!res.ok) throw new Error('AI request failed');
          return res.json();
        } catch (error) {
          console.error('AI chat error:', error);
          // 如果AI请求失败，返回默认响应，确保前端功能不会完全崩溃
          return {
            candidates: [{
              content: {
                parts: [{
                  text: '抱歉，AI服务暂时不可用，请稍后再试。'
                }]
              }
            }]
          };
        }
      }
  },
  rag: {
    // 构建RAG
    build: async (data: { name: string; sourceIds: string[]; config?: any }) => {
      try {
        const res = await fetch(`${API_BASE_URL}/rag/build`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to build RAG');
        return res.json();
      } catch (error) {
        console.error('Build RAG error:', error);
        throw error;
      }
    },
    // 获取已构建的RAG列表
    list: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/rag/builds`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch RAG builds');
        return res.json();
      } catch (error) {
        console.error('Fetch RAG builds error:', error);
        return [];
      }
    },
    // 获取单个RAG详情
    getById: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/rag/builds/${id}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch RAG build');
        return res.json();
      } catch (error) {
        console.error('Fetch RAG build error:', error);
        return null;
      }
    },
    // 删除RAG
    delete: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/rag/builds/${id}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to delete RAG build');
        return res.json();
      } catch (error) {
        console.error('Delete RAG build error:', error);
        throw error;
      }
    },
    // 分享RAG到社区
    share: async (id: string, data?: { description?: string; tags?: string[] }) => {
      try {
        const res = await fetch(`${API_BASE_URL}/rag-workshop/sessions/${id}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data || {}),
        });
        if (!res.ok) throw new Error('Failed to share RAG');
        return res.json();
      } catch (error) {
        console.error('Share RAG error:', error);
        throw error;
      }
    },
    // 从社区添加RAG到AI工坊
    addFromCommunity: async (communityId: string, data?: { name?: string; description?: string }) => {
      try {
        const res = await fetch(`${API_BASE_URL}/rag-workshop/add-from-community/${communityId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data || {}),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: 'Failed to add RAG from community' }));
          throw new Error(errorData.message || 'Failed to add RAG from community');
        }
        return res.json();
      } catch (error) {
        console.error('Add RAG from community error:', error);
        throw error;
      }
    },
    // 查询RAG
    query: async (ragId: string, question: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/rag/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ ragId, question }),
        });
        if (!res.ok) throw new Error('Failed to query RAG');
        return res.json();
      } catch (error) {
        console.error('Query RAG error:', error);
        throw error;
      }
    },
  },
  community: {
    feed: async (category?: string, contentType?: string, following?: boolean, page?: number, limit?: number) => {
      try {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (contentType) params.append('contentType', contentType);
        if (following) params.append('following', 'true');
        if (page) params.append('page', page.toString());
        if (limit) params.append('limit', limit.toString());
        const url = `${API_BASE_URL}/community/feed${params.toString() ? `?${params.toString()}` : ''}`;
        // feed 接口不需要认证，支持游客访问
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch community feed');
        return res.json();
      } catch (error) {
        console.error('Fetch community feed error:', error);
        return { items: [], total: 0, hasMore: false };
      }
    },
    headlines: async () => {
      try {
        // headlines 接口不需要认证，支持游客访问
        const res = await fetch(`${API_BASE_URL}/community/headlines`);
        if (!res.ok) throw new Error('Failed to fetch community headlines');
        return res.json();
      } catch (error) {
        console.error('Fetch community headlines error:', error);
        return [];
      }
    },
    projects: async () => {
      try {
        // projects 接口不需要认证，支持游客访问
        const res = await fetch(`${API_BASE_URL}/community/projects`);
        if (!res.ok) throw new Error('Failed to fetch community projects');
        return res.json();
      } catch (error) {
        console.error('Fetch community projects error:', error);
        return [];
      }
    },
    getBlogById: async (id: string) => {
      try {
        // getBlogById 接口不需要认证，支持游客访问
        const res = await fetch(`${API_BASE_URL}/community/blogs/${id}`);
        if (!res.ok) throw new Error('Failed to fetch blog by id');
        return res.json();
      } catch (error) {
        console.error('Fetch blog by id error:', error);
        return null;
      }
    },
    getById: async (id: string) => {
      try {
        // getById 接口不需要认证，支持游客访问
        const res = await fetch(`${API_BASE_URL}/community/${id}`);
        if (!res.ok) throw new Error('Failed to fetch community content by id');
        return res.json();
      } catch (error) {
        console.error('Fetch community content by id error:', error);
        throw error;
      }
    },
    incrementStars: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/community/${id}/stars`, {
          method: 'POST',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to increment stars');
        return res.json();
      } catch (error) {
        console.error('Increment stars error:', error);
        throw error;
      }
    },
    decrementStars: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/community/${id}/stars`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to decrement stars');
        return res.json();
      } catch (error) {
        console.error('Decrement stars error:', error);
        throw error;
      }
    },
    incrementDownloads: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/community/${id}/downloads`, {
          method: 'POST',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to increment downloads');
        return res.json();
      } catch (error) {
        console.error('Increment downloads error:', error);
        throw error;
      }
    },
    saveAISummary: async (id: string, aiSummary: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/community/${id}/ai-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ ai_summary: aiSummary }),
        });
        if (!res.ok) throw new Error('Failed to save AI summary');
        return res.json();
      } catch (error) {
        console.error('Save AI summary error:', error);
        throw error;
      }
    },
    publish: async (data: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/community`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to publish to community');
        return res.json();
      } catch (error) {
        console.error('Publish to community error:', error);
        throw error;
      }
    },
    update: async (id: string, data: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/community/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to update community content');
        return res.json();
      } catch (error) {
        console.error('Update community content error:', error);
        throw error;
      }
    },
    delete: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/community/${id}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to delete community content');
        
        // 检查响应是否有内容
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            return await res.json();
          } catch (jsonError) {
            // 如果JSON解析失败，返回空对象
            return {};
          }
        }
        // 如果没有JSON内容，返回空对象
        return {};
      } catch (error) {
        console.error('Delete community content error:', error);
        throw error;
      }
    },
    getByAuthorHandle: async (handle: string) => {
      try {
        // getByAuthorHandle 接口不需要认证，支持游客访问
        const res = await fetch(`${API_BASE_URL}/community/user/${encodeURIComponent(handle)}`);
        if (!res.ok) throw new Error('Failed to fetch user community content');
        return res.json();
      } catch (error) {
        console.error('Fetch user community content error:', error);
        return [];
      }
    },
    search: async (keyword: string) => {
      try {
        // search 接口不需要认证，支持游客访问
        const res = await fetch(`${API_BASE_URL}/community/search?q=${encodeURIComponent(keyword)}`);
        if (!res.ok) throw new Error('Failed to search community content');
        return res.json();
      } catch (error) {
        console.error('Search community content error:', error);
        return { blogs: [], resources: [], projects: [] };
      }
    },
    // 获取社区统计数据（活跃用户、贡献者等）
    stats: async () => {
      try {
        // stats 接口不需要认证，支持游客访问
        const res = await fetch(`${API_BASE_URL}/community/stats`);
        if (!res.ok) throw new Error('Failed to fetch community stats');
        return res.json();
      } catch (error) {
        console.error('Fetch community stats error:', error);
        return { activeUsers: 0, contributors: 0, newThisMonth: 0, totalDownloads: 0 };
      }
    },
    // 学习链接相关 API
    learningLinks: {
      list: async () => {
        try {
          // learningLinks list 接口不需要认证，支持游客访问
          const res = await fetch(`${API_BASE_URL}/community/learning-links`);
          if (!res.ok) throw new Error('Failed to fetch learning links');
          return res.json();
        } catch (error) {
          console.error('Fetch learning links error:', error);
          return [];
        }
      },
      create: async (data: any) => {
        try {
          const res = await fetch(`${API_BASE_URL}/community/learning-links`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify(data),
          });
          if (!res.ok) throw new Error('Failed to create learning link');
          return res.json();
        } catch (error) {
          console.error('Create learning link error:', error);
          throw error;
        }
      },
      getById: async (id: string) => {
        try {
          // learningLinks getById 接口不需要认证，支持游客访问
          const res = await fetch(`${API_BASE_URL}/community/learning-links/${id}`);
          if (!res.ok) throw new Error('Failed to fetch learning link');
          return res.json();
        } catch (error) {
          console.error('Fetch learning link error:', error);
          return null;
        }
      },
      update: async (id: string, data: any) => {
        try {
          const res = await fetch(`${API_BASE_URL}/community/learning-links/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
            body: JSON.stringify(data),
          });
          if (!res.ok) throw new Error('Failed to update learning link');
          return res.json();
        } catch (error) {
          console.error('Update learning link error:', error);
          throw error;
        }
      },
      delete: async (id: string) => {
        try {
          const res = await fetch(`${API_BASE_URL}/community/learning-links/${id}`, {
            method: 'DELETE',
            headers: getAuthHeader(),
          });
          if (!res.ok) throw new Error('Failed to delete learning link');
          return res.json();
        } catch (error) {
          console.error('Delete learning link error:', error);
          throw error;
        }
      },
      incrementStars: async (id: string) => {
        try {
          const res = await fetch(`${API_BASE_URL}/community/learning-links/${id}/stars`, {
            method: 'POST',
            headers: getAuthHeader(),
          });
          if (!res.ok) throw new Error('Failed to increment stars');
          return res.json();
        } catch (error) {
          console.error('Increment stars error:', error);
          throw error;
        }
      },
      decrementStars: async (id: string) => {
        try {
          const res = await fetch(`${API_BASE_URL}/community/learning-links/${id}/stars`, {
            method: 'DELETE',
            headers: getAuthHeader(),
          });
          if (!res.ok) throw new Error('Failed to decrement stars');
          return res.json();
        } catch (error) {
          console.error('Decrement stars error:', error);
          throw error;
        }
      },
    },
    // 验证 URL SSL 证书
    verifySsl: async (url: string) => {
      try {
        // verifySsl 接口不需要认证，支持游客访问
        const res = await fetch(`${API_BASE_URL}/community/verify-ssl?url=${encodeURIComponent(url)}`);
        if (!res.ok) throw new Error('Failed to verify SSL');
        return res.json();
      } catch (error) {
        console.error('Verify SSL error:', error);
        return { valid: false, message: 'SSL verification failed' };
      }
    },
  },
  groups: {
    // 获取所有社群
    list: async (query?: any) => {
      try {
        const queryString = query ? `?${new URLSearchParams(query).toString()}` : '';
        const res = await fetch(`${API_BASE_URL}/groups${queryString}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch groups');
        return res.json();
      } catch (error) {
        console.error('Fetch groups error:', error);
        return [];
      }
    },
    // 获取热门社群
    hot: async (limit?: number) => {
      try {
        const url = `${API_BASE_URL}/groups/hot${limit ? `?limit=${limit}` : ''}`;
        const res = await fetch(url, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch hot groups');
        return res.json();
      } catch (error) {
        console.error('Fetch hot groups error:', error);
        return [];
      }
    },
    // 获取推荐社群
    recommended: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/recommended`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch recommended groups');
        return res.json();
      } catch (error) {
        console.error('Fetch recommended groups error:', error);
        return [];
      }
    },
    // 获取我加入的社群
    myGroups: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/my-groups`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch my groups');
        return res.json();
      } catch (error) {
        console.error('Fetch my groups error:', error);
        return [];
      }
    },
    // 获取我创建的社群
    createdByMe: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/created-by-me`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch created groups');
        return res.json();
      } catch (error) {
        console.error('Fetch created groups error:', error);
        return [];
      }
    },
    // 搜索社群
    search: async (keyword: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/search?keyword=${encodeURIComponent(keyword)}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to search groups');
        return res.json();
      } catch (error) {
        console.error('Search groups error:', error);
        return [];
      }
    },
    // 获取社群详情
    getById: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch group');
        return res.json();
      } catch (error) {
        console.error('Fetch group error:', error);
        throw error;
      }
    },
    // 更新社群
    update: async (id: string, data: any) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to update group');
        }
        return res.json();
      } catch (error) {
        console.error('Update group error:', error);
        throw error;
      }
    },
    // 创建社群
    create: async (data: any) => {
      try {
        console.log('Creating group with data:', data);
        const res = await fetch(`${API_BASE_URL}/groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify(data),
        });
        console.log('Create group response status:', res.status);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Create group error response:', errorText);
          let errorData: { message?: string } = {};
          try {
            errorData = JSON.parse(errorText);
          } catch (e) {
            // 不是 JSON 格式
          }
          throw new Error(errorData.message || errorText || 'Failed to create group');
        }
        return res.json();
      } catch (error) {
        console.error('Create group error:', error);
        throw error;
      }
    },
    // 删除社群
    delete: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to delete group');
        return res.json();
      } catch (error) {
        console.error('Delete group error:', error);
        throw error;
      }
    },
    // 加入社群
    join: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}/join`, {
          method: 'POST',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to join group');
        return res.json();
      } catch (error) {
        console.error('Join group error:', error);
        throw error;
      }
    },
    // 退出社群
    leave: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}/leave`, {
          method: 'POST',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to leave group');
        return res.json();
      } catch (error) {
        console.error('Leave group error:', error);
        throw error;
      }
    },
    // 检查是否已加入
    isMember: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}/is-member`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to check membership');
        return res.json();
      } catch (error) {
        console.error('Check membership error:', error);
        return { isMember: false };
      }
    },
    // 获取社群成员列表
    getMembers: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}/members`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch group members');
        return res.json();
      } catch (error) {
        console.error('Fetch group members error:', error);
        return { members: [], admins: [], creator: null };
      }
    },
    // 获取群组消息列表
    getMessages: async (id: string, limit?: number, before?: string) => {
      try {
        let url = `${API_BASE_URL}/groups/${id}/messages`;
        const params = new URLSearchParams();
        if (limit) params.append('limit', limit.toString());
        if (before) params.append('before', before);
        if (params.toString()) url += `?${params.toString()}`;
        
        const res = await fetch(url, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch group messages');
        return res.json();
      } catch (error) {
        console.error('Fetch group messages error:', error);
        return [];
      }
    },
    // 发送群组消息
    sendMessage: async (id: string, content: string, messageType?: string, replyTo?: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ content, message_type: messageType || 'text', reply_to: replyTo }),
        });
        if (!res.ok) throw new Error('Failed to send group message');
        return res.json();
      } catch (error) {
        console.error('Send group message error:', error);
        throw error;
      }
    },
    // 删除群组消息
    deleteMessage: async (id: string, messageId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}/messages/${messageId}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to delete group message');
        return res.json();
      } catch (error) {
        console.error('Delete group message error:', error);
        throw error;
      }
    },
    // 提交加入申请
    submitJoinRequest: async (id: string, message: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}/join-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ message }),
        });
        if (!res.ok) throw new Error('Failed to submit join request');
        return res.json();
      } catch (error) {
        console.error('Submit join request error:', error);
        throw error;
      }
    },
    // 获取社群的加入申请列表（管理员/创建者用）
    getJoinRequests: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}/join-requests`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch join requests');
        return res.json();
      } catch (error) {
        console.error('Fetch join requests error:', error);
        return [];
      }
    },
    // 获取我的加入申请列表
    getMyJoinRequests: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/my-join-requests`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch my join requests');
        return res.json();
      } catch (error) {
        console.error('Fetch my join requests error:', error);
        return [];
      }
    },
    // 处理加入申请（通过或拒绝）
    processJoinRequest: async (requestId: string, approve: boolean, rejectReason?: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/join-requests/${requestId}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ approve, rejectReason }),
        });
        if (!res.ok) throw new Error('Failed to process join request');
        return res.json();
      } catch (error) {
        console.error('Process join request error:', error);
        throw error;
      }
    },
    // 取消我的加入申请
    cancelJoinRequest: async (requestId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/join-requests/${requestId}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to cancel join request');
        return res.json();
      } catch (error) {
        console.error('Cancel join request error:', error);
        throw error;
      }
    },
    // 获取待处理申请数量
    getPendingJoinRequestCount: async (id: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${id}/join-requests/pending-count`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch pending count');
        return res.json();
      } catch (error) {
        console.error('Fetch pending count error:', error);
        return { count: 0 };
      }
    },
    // ==================== 邀请相关 API ====================
    // 创建邀请
    createInvite: async (groupId: string, inviteeHandle: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${groupId}/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
          body: JSON.stringify({ invitee_handle: inviteeHandle }),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to create invite');
        }
        return res.json();
      } catch (error) {
        console.error('Create invite error:', error);
        throw error;
      }
    },
    // 获取社群邀请列表
    getGroupInvites: async (groupId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${groupId}/invites`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch group invites');
        return res.json();
      } catch (error) {
        console.error('Fetch group invites error:', error);
        return [];
      }
    },
    // 获取我的邀请列表
    getMyInvites: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/invites/my`, {
          headers: getAuthHeader(),
        });
        if (!res.ok) throw new Error('Failed to fetch my invites');
        return res.json();
      } catch (error) {
        console.error('Fetch my invites error:', error);
        return [];
      }
    },
    // 接受邀请
    acceptInvite: async (inviteId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/invites/${inviteId}/accept`, {
          method: 'POST',
          headers: getAuthHeader(),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to accept invite');
        }
        return res.json();
      } catch (error) {
        console.error('Accept invite error:', error);
        throw error;
      }
    },
    // 拒绝邀请
    rejectInvite: async (inviteId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/invites/${inviteId}/reject`, {
          method: 'POST',
          headers: getAuthHeader(),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to reject invite');
        }
        return res.json();
      } catch (error) {
        console.error('Reject invite error:', error);
        throw error;
      }
    },
    // 取消邀请
    cancelInvite: async (inviteId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/invites/${inviteId}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to cancel invite');
        }
        return res.json();
      } catch (error) {
        console.error('Cancel invite error:', error);
        throw error;
      }
    },
    // 踢出成员
    removeMember: async (groupId: string, memberId: string) => {
      try {
        const res = await fetch(`${API_BASE_URL}/groups/${groupId}/members/${memberId}`, {
          method: 'DELETE',
          headers: getAuthHeader(),
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to remove member');
        }
        return res.json();
      } catch (error) {
        console.error('Remove member error:', error);
        throw error;
      }
    },
  }
};
