"use client";

import React, { useState, useRef, useCallback } from "react";
import { Send, Loader2, BookOpen, Quote } from "lucide-react";
import { queryRagStream, QueryMode, Reference } from "@/services/rag";
import { marked } from "marked";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
  metadata?: {
    mode: string;
    processingTime: number;
    chunksRetrieved: number;
  };
}

interface RagChatProps {
  vaultId?: string;
  mode?: QueryMode;
}

export function RagChat({ vaultId, mode = QueryMode.MIX }: RagChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const assistantMessageId = (Date.now() + 1).toString();
      let assistantContent = "";
      let assistantReferences: Reference[] = [];
      let assistantMetadata: any = null;

      // 添加空的助手消息
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
        },
      ]);

      // 构建对话历史
      const conversationHistory = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // 流式查询
      const stream = queryRagStream({
        query: input,
        mode,
        vaultId,
        conversationHistory,
        includeReferences: true,
        topK: 5,
      });

      for await (const chunk of stream) {
        if (chunk.error) {
          throw new Error(chunk.error);
        }

        if (chunk.references) {
          assistantReferences = chunk.references;
        }

        if (chunk.response) {
          assistantContent += chunk.response;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: assistantContent }
                : m
            )
          );
        }

        if (chunk.done) {
          break;
        }

        scrollToBottom();
      }

      // 更新最终消息
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMessageId
            ? {
                ...m,
                content: assistantContent,
                references: assistantReferences,
                metadata: assistantMetadata,
              }
            : m
        )
      );
    } catch (error: any) {
      console.error("RAG query error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: `抱歉，查询时出现错误：${error.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  return (
    <div className="w-full h-[600px] flex flex-col bg-white rounded-lg border shadow-sm">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <BookOpen className="w-5 h-5" />
            RAG 知识库对话
          </div>
          <span className="px-2 py-1 bg-gray-100 text-xs rounded-full">
            {mode} 模式
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>开始与知识库对话</p>
              <p className="text-sm mt-2">
                基于您上传的文档进行智能问答
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100"
                }`}
              >
                {message.role === "user" ? (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                ) : (
                  <div 
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: marked.parse(message.content || '', { async: false }) as string 
                    }}
                  />
                )}

                {message.references && message.references.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200/50">
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                      <Quote className="w-3 h-3" />
                      引用来源
                    </div>
                    <div className="space-y-1">
                      {message.references.slice(0, 3).map((ref, idx) => (
                        <div
                          key={ref.id}
                          className="text-xs text-gray-500 truncate"
                        >
                          [{idx + 1}] {ref.title}
                          {ref.score > 0 && (
                            <span className="ml-1 opacity-50">
                              (相似度: {(ref.score * 100).toFixed(1)}%)
                            </span>
                          )}
                        </div>
                      ))}
                      {message.references.length > 3 && (
                        <div className="text-xs text-gray-500">
                          ...还有 {message.references.length - 3} 个引用
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {message.metadata && (
                  <div className="mt-2 text-xs text-gray-400">
                    处理时间: {message.metadata.processingTime}ms | 
                    检索块数: {message.metadata.chunksRetrieved}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg p-3">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t p-4 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入您的问题..."
          disabled={isLoading}
          className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
