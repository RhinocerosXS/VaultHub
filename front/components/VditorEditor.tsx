import React, { useEffect, useRef, useCallback, useState } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import { getStoredVditorTheme, onVditorThemeChange, VditorTheme } from '../utils/themeStorage';

interface VditorEditorProps {
  /** 容器类名 */
  className?: string;
  /** 初始内容 */
  initialValue?: string;
  /** 占位符文本 */
  placeholder?: string;
  /** 是否可编辑 */
  editable?: boolean;
  /** 内容变化回调 */
  onChange?: (content: string) => void;
  /** 失去焦点回调 */
  onBlur?: (content: string) => void;
  /** 编辑器模式: 'wysiwyg' | 'ir' | 'sv' */
  mode?: 'wysiwyg' | 'ir' | 'sv';
  /** 主题: 'dark' | 'light' | 'wechat' */
  theme?: 'dark' | 'light' | 'wechat';
  /** 高度 */
  height?: string;
  /** 最小高度 */
  minHeight?: string;
  /** 是否显示工具栏 */
  toolbar?: boolean;
  /** 自定义工具栏 */
  toolbarConfig?: {
    pin?: boolean;
    hide?: boolean;
  };
  /** 链接点击回调 */
  onLinkClick?: (link: string) => void;
}

/**
 * Vditor 个性化编辑器组件
 * 可嵌入到任何 div 中使用
 */
export const VditorEditor: React.FC<VditorEditorProps> = ({
  className = '',
  initialValue = '',
  placeholder = '请输入内容...',
  editable = true,
  onChange,
  onBlur,
  mode = 'wysiwyg',
  theme: propTheme,
  height = '100%',
  minHeight = '300px',
  toolbar = true,
  toolbarConfig = { pin: true },
  onLinkClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const vditorInstance = useRef<Vditor | null>(null);
  const lastContentRef = useRef<string>(initialValue);

  // 如果没有传入主题，使用存储的主题
  const [theme, setTheme] = useState<VditorTheme>(() => propTheme || getStoredVditorTheme());

  // 监听主题变化
  useEffect(() => {
    // 如果传入了主题属性，使用它
    if (propTheme) {
      setTheme(propTheme);
    }

    // 监听全局主题变化
    const unsubscribe = onVditorThemeChange((newTheme) => {
      if (!propTheme) {
        setTheme(newTheme);
      }
    });

    return unsubscribe;
  }, [propTheme]);

  // 调整 Vditor 样式的函数
  const adjustVditorStyles = useCallback(() => {
    const isDark = theme === 'dark';
    const isWechat = theme === 'wechat';
    
    // WeChat 主题使用特定的配色
    const bgColor = isWechat ? '#f5f5f5' : (isDark ? '#1e1e1e' : '#ffffff');
    const textColor = isWechat ? '#333333' : (isDark ? '#ffffff' : '#333333');
    const borderColor = isWechat ? '#e0e0e0' : (isDark ? '#3e3e3e' : '#e0e0e0');
    const toolbarBg = isWechat ? '#ffffff' : (isDark ? '#252525' : '#f5f5f5');
    const linkColor = isWechat ? '#576b95' : (isDark ? '#61afef' : '#0366d6');
    const codeBg = isWechat ? '#f0f0f0' : (isDark ? '#252525' : '#f6f8fa');
    const blockquoteBorder = isWechat ? '#07c160' : (isDark ? '#61afef' : '#0366d6');

    // 调整编辑器主要区域背景颜色
    const editorElements = document.querySelectorAll('.vditor, .vditor-wysiwyg, .vditor-sv, .vditor-content, .vditor-preview, .vditor-body, .vditor-edit-area');
    editorElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.backgroundColor = bgColor;
      htmlElement.style.border = 'none';
      htmlElement.style.boxShadow = 'none';
    });

    // 调整工具栏样式
    if (toolbar) {
      const toolbarElements = document.querySelectorAll('.vditor-toolbar');
      toolbarElements.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.backgroundColor = toolbarBg;
        htmlElement.style.borderBottom = `1px solid ${borderColor}`;
        htmlElement.style.boxShadow = 'none';
        htmlElement.style.padding = '8px 12px';
        htmlElement.style.display = 'flex';
        htmlElement.style.flexWrap = 'wrap';
        htmlElement.style.gap = '4px';
      });

      // 调整工具栏项目样式
      const toolbarItems = document.querySelectorAll('.vditor-toolbar__item');
      toolbarItems.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.display = 'flex';
        htmlElement.style.alignItems = 'center';
        htmlElement.style.justifyContent = 'center';
        htmlElement.style.minWidth = '32px';
        htmlElement.style.height = '32px';
        htmlElement.style.margin = '0 2px';
      });

      // 调整工具栏按钮样式
      const toolbarButtons = document.querySelectorAll('.vditor-toolbar button, .vditor-toolbar__item button');
      toolbarButtons.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.display = 'flex';
        htmlElement.style.alignItems = 'center';
        htmlElement.style.justifyContent = 'center';
        htmlElement.style.width = '32px';
        htmlElement.style.height = '32px';
        htmlElement.style.padding = '6px';
        htmlElement.style.border = 'none';
        htmlElement.style.backgroundColor = 'transparent';
        htmlElement.style.color = isDark ? '#d4d4d4' : '#666666';
        htmlElement.style.cursor = 'pointer';
        htmlElement.style.borderRadius = '4px';
      });

      // 调整工具栏分割线样式
      const toolbarDividers = document.querySelectorAll('.vditor-toolbar__divider');
      toolbarDividers.forEach(element => {
        const htmlElement = element as HTMLElement;
        htmlElement.style.width = '1px';
        htmlElement.style.height = '20px';
        htmlElement.style.backgroundColor = borderColor;
        htmlElement.style.margin = '6px 4px';
      });
    }

    // 调整标题样式
    const headingElements = document.querySelectorAll('.vditor-wysiwyg h1, .vditor-wysiwyg h2, .vditor-wysiwyg h3, .vditor-wysiwyg h4, .vditor-wysiwyg h5, .vditor-wysiwyg h6, .vditor-preview h1, .vditor-preview h2, .vditor-preview h3, .vditor-preview h4, .vditor-preview h5, .vditor-preview h6');
    headingElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.color = textColor;
      htmlElement.style.marginTop = '24px';
      htmlElement.style.marginBottom = '16px';
      htmlElement.style.fontWeight = 'bold';

      if (element.tagName === 'H1') {
        htmlElement.style.fontSize = '2.5rem';
        htmlElement.style.borderBottom = `2px solid ${borderColor}`;
        htmlElement.style.paddingBottom = '10px';
      } else if (element.tagName === 'H2') {
        htmlElement.style.fontSize = '2rem';
        htmlElement.style.borderBottom = `1px solid ${borderColor}`;
        htmlElement.style.paddingBottom = '8px';
      } else if (element.tagName === 'H3') {
        htmlElement.style.fontSize = '1.5rem';
        htmlElement.style.color = isDark ? '#e06c75' : '#d73a49';
      } else if (element.tagName === 'H4') {
        htmlElement.style.fontSize = '1.25rem';
        htmlElement.style.color = isDark ? '#61afef' : '#0366d6';
      } else if (element.tagName === 'H5') {
        htmlElement.style.fontSize = '1.1rem';
        htmlElement.style.color = isDark ? '#98c379' : '#28a745';
      } else if (element.tagName === 'H6') {
        htmlElement.style.fontSize = '1rem';
        htmlElement.style.color = isDark ? '#c678dd' : '#6f42c1';
      }
    });

    // 调整段落样式
    const paragraphElements = document.querySelectorAll('.vditor-wysiwyg p, .vditor-preview p');
    paragraphElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.color = textColor;
      htmlElement.style.marginTop = '12px';
      htmlElement.style.marginBottom = '12px';
      htmlElement.style.lineHeight = '1.6';
      htmlElement.style.fontSize = '16px';
    });

    // 调整代码块样式
    const preElements = document.querySelectorAll('.vditor-content pre, .vditor-wysiwyg pre, .vditor-preview pre');
    preElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.backgroundColor = codeBg;
      htmlElement.style.border = isWechat ? 'none' : `1px solid ${borderColor}`;
      htmlElement.style.borderRadius = '6px';
      htmlElement.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
      htmlElement.style.padding = '16px';
      htmlElement.style.marginTop = '16px';
      htmlElement.style.marginBottom = '16px';
      htmlElement.style.overflowX = 'auto';

      const codeElements = element.querySelectorAll('code');
      codeElements.forEach(codeEl => {
        const codeHtmlEl = codeEl as HTMLElement;
        codeHtmlEl.style.color = isWechat ? '#333333' : (isDark ? '#d4d4d4' : '#24292e');
        codeHtmlEl.style.fontFamily = '"Consolas", "Monaco", "Courier New", monospace';
        codeHtmlEl.style.fontSize = '14px';
        codeHtmlEl.style.lineHeight = '1.4';
      });
    });

    // 调整链接样式
    const linkElements = document.querySelectorAll('.vditor-wysiwyg a, .vditor-preview a');
    linkElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.color = linkColor;
      htmlElement.style.textDecoration = 'none';
      htmlElement.style.borderBottom = `1px solid ${linkColor}`;
      htmlElement.style.paddingBottom = '2px';
      htmlElement.style.cursor = 'pointer';
    });

    // 调整列表样式
    const listElements = document.querySelectorAll('.vditor-wysiwyg ul, .vditor-wysiwyg ol, .vditor-preview ul, .vditor-preview ol');
    listElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.color = textColor;
      htmlElement.style.marginTop = '12px';
      htmlElement.style.marginBottom = '12px';
      htmlElement.style.paddingLeft = '32px';
    });

    // 调整引用样式
    const blockquoteElements = document.querySelectorAll('.vditor-wysiwyg blockquote, .vditor-preview blockquote');
    blockquoteElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.backgroundColor = codeBg;
      htmlElement.style.borderLeft = `4px solid ${blockquoteBorder}`;
      htmlElement.style.padding = '16px 20px';
      htmlElement.style.marginTop = '16px';
      htmlElement.style.marginBottom = '16px';
      htmlElement.style.borderRadius = '0 6px 6px 0';
    });

    // 调整图片样式
    const imageElements = document.querySelectorAll('.vditor-wysiwyg img, .vditor-preview img');
    imageElements.forEach(element => {
      const htmlElement = element as HTMLElement;
      htmlElement.style.maxWidth = '100%';
      htmlElement.style.height = 'auto';
      htmlElement.style.borderRadius = '6px';
      htmlElement.style.marginTop = '16px';
      htmlElement.style.marginBottom = '16px';
      htmlElement.style.display = 'block';
    });

    // 调整容器背景
    if (containerRef.current) {
      containerRef.current.style.backgroundColor = bgColor;
      containerRef.current.style.height = height;
      containerRef.current.style.minHeight = minHeight;
    }
  }, [theme, height, minHeight, toolbar]);

  // 初始化 Vditor
  useEffect(() => {
    if (!containerRef.current) return;

    let initializationTimeout: NodeJS.Timeout;

    const initVditor = () => {
      if (!containerRef.current) return;

      try {
        // 销毁旧实例
        if (vditorInstance.current) {
          vditorInstance.current.destroy();
          vditorInstance.current = null;
        }

        // 清空容器
        containerRef.current.innerHTML = '';

        if (editable) {
          // 编辑模式
          // wechat 主题使用 classic 模式作为基础，vditor 只支持 dark 或 classic
          const editorTheme = theme === 'dark' ? 'dark' : 'classic';
          vditorInstance.current = new Vditor(containerRef.current, {
            value: initialValue,
            placeholder,
            mode,
            theme: editorTheme,
            preview: {
              theme: {
                current: editorTheme
              }
            },
            toolbarConfig: {
              pin: toolbarConfig.pin ?? true,
              hide: toolbarConfig.hide ?? !toolbar,
            },
            cache: {
              enable: false
            },
            upload: {
              max: 10 * 1024 * 1024,
              handler: function (files: File[]) {
                console.log('Upload files:', files);
                return '';
              }
            },
            link: {
              click: function(bom: any) {
                const link = bom.textContent || '';
                console.log('Link clicked:', link);
                if (onLinkClick) {
                  onLinkClick(link);
                }
              }
            },
            after: () => {
              console.log('Vditor initialized successfully');
              setTimeout(() => {
                adjustVditorStyles();
              }, 100);
            },
            input: () => {
              if (vditorInstance.current) {
                const content = vditorInstance.current.getValue();
                lastContentRef.current = content;
                onChange?.(content);
              }
            },
            blur: () => {
              if (vditorInstance.current) {
                const content = vditorInstance.current.getValue();
                lastContentRef.current = content;
                onBlur?.(content);
              }
            }
          });
        } else {
          // 预览模式
          // wechat 主题使用 light 模式作为基础
          const previewMode = theme === 'wechat' ? 'light' : theme;
          Vditor.preview(containerRef.current, initialValue, {
            mode: previewMode,
            theme: {
              current: previewMode
            },
            hljs: {
              style: theme === 'dark' ? 'dracula' : 'github'
            },
            after: () => {
              console.log('Vditor preview initialized successfully');
              setTimeout(() => {
                adjustVditorStyles();
              }, 100);
            }
          });
        }
      } catch (error) {
        console.error('Error initializing Vditor:', error);
      }
    };

    // 延迟初始化确保 DOM 已渲染
    initializationTimeout = setTimeout(initVditor, 100);

    return () => {
      clearTimeout(initializationTimeout);
      if (vditorInstance.current) {
        vditorInstance.current.destroy();
        vditorInstance.current = null;
      }
    };
  }, [editable, mode, theme, toolbar, toolbarConfig, placeholder, onLinkClick, adjustVditorStyles]);

  // 当初始值变化时更新内容
  useEffect(() => {
    if (vditorInstance.current && initialValue !== lastContentRef.current) {
      vditorInstance.current.setValue(initialValue);
      lastContentRef.current = initialValue;
    }
  }, [initialValue]);

  return (
    <div
      ref={containerRef}
      className={`vditor-editor-container ${className}`}
      style={{
        height,
        minHeight,
        backgroundColor: theme === 'dark' ? '#1e1e1e' : (theme === 'wechat' ? '#f5f5f5' : '#ffffff'),
      }}
    />
  );
};

export default VditorEditor;
