// 编辑器主题存储工具
const THEME_STORAGE_KEY = 'vditor-preview-theme';

export type VditorTheme = 'dark' | 'light' | 'wechat';

/**
 * 获取保存的预览主题
 * @returns 主题名称，默认为 'dark'
 */
export const getStoredVditorTheme = (): VditorTheme => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && ['dark', 'light', 'wechat'].includes(stored)) {
      return stored as VditorTheme;
    }
  } catch (error) {
    console.error('Failed to get stored theme:', error);
  }
  return 'dark';
};

/**
 * 保存预览主题
 * @param theme 主题名称
 */
export const setStoredVditorTheme = (theme: VditorTheme): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    // 触发自定义事件，通知其他组件主题已更改
    window.dispatchEvent(new CustomEvent('vditor-theme-changed', { detail: { theme } }));
  } catch (error) {
    console.error('Failed to store theme:', error);
  }
};

/**
 * 监听主题变化
 * @param callback 主题变化时的回调函数
 * @returns 取消监听的函数
 */
export const onVditorThemeChange = (callback: (theme: VditorTheme) => void): (() => void) => {
  const handler = (event: CustomEvent) => {
    callback(event.detail.theme as VditorTheme);
  };
  
  window.addEventListener('vditor-theme-changed', handler as EventListener);
  
  // 返回取消监听的函数
  return () => {
    window.removeEventListener('vditor-theme-changed', handler as EventListener);
  };
};
