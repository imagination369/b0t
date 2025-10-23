'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import Image from 'next/image';

const SUGGESTED_QUESTIONS = [
  'What is Social Cat?',
  'How do I automate Twitter posts?',
  'How do I connect my accounts?',
  'What features are available?',
];

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

// Typing indicator component
const TypingIndicator = () => (
  <div className="flex w-full">
    <div className="flex flex-col items-start gap-1">
      <div className="rounded-[20px] rounded-tl rounded-bl-[20px] bg-zinc-200/50 px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  </div>
);

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSuggestedQuestion = async (question: string) => {
    setInputValue('');

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let pendingUpdate = '';
      let updateScheduled = false;

      const assistantMsgId = (Date.now() + 1).toString();

      const scheduleUpdate = () => {
        if (!updateScheduled) {
          updateScheduled = true;
          requestAnimationFrame(() => {
            assistantMessage += pendingUpdate;
            pendingUpdate = '';
            updateScheduled = false;

            setMessages((prev) => {
              const withoutLast = prev.filter(m => m.id !== assistantMsgId);
              return [...withoutLast, {
                id: assistantMsgId,
                role: 'assistant',
                content: assistantMessage,
              }];
            });
          });
        }
      };

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Flush any pending updates
            if (pendingUpdate) {
              assistantMessage += pendingUpdate;
              setMessages((prev) => {
                const withoutLast = prev.filter(m => m.id !== assistantMsgId);
                return [...withoutLast, {
                  id: assistantMsgId,
                  role: 'assistant',
                  content: assistantMessage,
                }];
              });
            }
            break;
          }

          const chunk = decoder.decode(value);
          pendingUpdate += chunk;
          scheduleUpdate();
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let pendingUpdate = '';
      let updateScheduled = false;

      const assistantMsgId = (Date.now() + 1).toString();

      const scheduleUpdate = () => {
        if (!updateScheduled) {
          updateScheduled = true;
          requestAnimationFrame(() => {
            assistantMessage += pendingUpdate;
            pendingUpdate = '';
            updateScheduled = false;

            setMessages((prev) => {
              const withoutLast = prev.filter(m => m.id !== assistantMsgId);
              return [...withoutLast, {
                id: assistantMsgId,
                role: 'assistant',
                content: assistantMessage,
              }];
            });
          });
        }
      };

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Flush any pending updates
            if (pendingUpdate) {
              assistantMessage += pendingUpdate;
              setMessages((prev) => {
                const withoutLast = prev.filter(m => m.id !== assistantMsgId);
                return [...withoutLast, {
                  id: assistantMsgId,
                  role: 'assistant',
                  content: assistantMessage,
                }];
              });
            }
            break;
          }

          const chunk = decoder.decode(value);
          pendingUpdate += chunk;
          scheduleUpdate();
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[406px] h-[718.5px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 font-[family-name:var(--font-inter)] [&_p]:!text-black [&_div]:!text-black [&_span]:!text-zinc-950 [&_h1]:!text-black [&_h1]:!text-xl [&_h1]:!font-bold [&_h1]:!mt-3 [&_h1]:!mb-1.5 [&_h2]:!text-lg [&_h2]:!font-bold [&_h2]:!mt-2 [&_h2]:!mb-1.5 [&_h2]:!text-black [&_h3]:!text-base [&_h3]:!font-semibold [&_h3]:!mt-2 [&_h3]:!mb-1 [&_h3]:!text-black [&_h4]:!text-black [&_h5]:!text-black [&_h6]:!text-black [&_strong]:!text-black [&_strong]:!font-semibold [&_em]:!text-black [&_li]:!text-black [&_li]:!mb-1.5 [&_li]:!leading-relaxed [&_ul]:!text-black [&_ul]:!ml-0 [&_ul]:!my-2 [&_ul]:!list-disc [&_ul]:!pl-5 [&_ol]:!text-black [&_ol]:!ml-0 [&_ol]:!my-2 [&_ol]:!list-decimal [&_ol]:!pl-5 [&_p]:!mb-1.5 [&_p]:!leading-relaxed">
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 text-white"
            style={{
              background: 'linear-gradient(0deg, rgba(255, 255, 255, 0) 29.14%, rgba(255, 255, 255, 0.16) 100%), #ff6b35',
            }}
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-white/20 rounded-full flex items-center justify-center">
                <Image src="/cat-icon.svg" alt="Social Cat" width={20} height={20} />
              </div>
              <span className="font-black text-xs tracking-tight" style={{ color: 'white' }}>SOCIAL CAT</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md opacity-70 hover:opacity-85"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 shadow-inner [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-zinc-400">
            {messages.length === 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex w-full">
                  <div className="flex w-full flex-col items-start gap-1">
                    <div className="relative w-full max-w-[min(calc(100%-40px),65ch)] pr-3">
                      <div className="rounded-[20px] rounded-tl-[20px] rounded-bl bg-zinc-200/50 px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-6 w-6 bg-accent rounded-full flex items-center justify-center">
                            <Image src="/cat-icon.svg" alt="Social Cat" width={16} height={16} />
                          </div>
                          <span className="font-medium text-sm text-zinc-950 leading-normal tracking-tight">
                            Social Cat Assistant
                          </span>
                        </div>
                        <div className="text-sm text-black leading-normal tracking-tight prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            👋 Hi! I am Social Cat Assistant, ask me anything about Social Cat!
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                    <div className="relative w-full max-w-[min(calc(100%-40px),65ch)] pr-3">
                      <div className="rounded-[20px] rounded-tl rounded-bl-[20px] bg-zinc-200/50 px-4 py-3">
                        <div className="text-sm text-black leading-normal tracking-tight prose prose-sm max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            By the way, you can automate your social media with Social Cat! 🚀
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => (
                  <div key={message.id} className="flex w-full">
                    {message.role === 'assistant' ? (
                      <div className="flex w-full flex-col items-start gap-1">
                        <div className="relative w-full max-w-[min(calc(100%-40px),65ch)] pr-3">
                          <div className={`rounded-[20px] ${index === 0 ? 'rounded-tl-[20px] rounded-bl' : 'rounded-tl rounded-bl-[20px]'} bg-zinc-200/50 px-4 py-3`}>
                            {index === 0 && (
                              <div className="flex items-center gap-2 mb-2">
                                <div className="h-6 w-6 bg-accent rounded-full flex items-center justify-center">
                                  <Image src="/cat-icon.svg" alt="Social Cat" width={16} height={16} />
                                </div>
                                <span className="font-medium text-sm text-zinc-950 leading-normal tracking-tight">
                                  Social Cat Assistant
                                </span>
                              </div>
                            )}
                            <div className="text-sm text-black leading-normal tracking-tight prose prose-sm max-w-none">
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex w-full flex-col items-end gap-1">
                        <div className="relative w-full max-w-[min(calc(100%-40px),65ch)] pl-3 flex justify-end">
                          <div className="rounded-[20px] rounded-tr-sm bg-accent px-4 py-3 text-white">
                            <div className="text-sm leading-normal tracking-tight">
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                  <TypingIndicator />
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested questions */}
          {messages.length === 0 && (
            <div className="px-5 pb-2">
              <div className="flex flex-wrap gap-2 justify-end" style={{ maxHeight: '136px' }}>
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="flex items-center justify-center gap-1.5 h-auto min-h-10 max-w-[40ch] rounded-[30px] border border-zinc-200 px-4 py-2 font-normal text-sm shadow-none transition-colors whitespace-break-spaces hyphens-auto break-words bg-white text-zinc-600 hover:bg-[#ff6b35] hover:text-white hover:border-[#ff6b35]"
                    style={{
                      '--button-hover-bg': '#ff6b35',
                      '--button-hover-textColor': '#ffffff',
                      '--button-hover-border': '#ff6b35',
                    } as React.CSSProperties}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="relative z-50 mx-4 mb-4 flex min-h-13 flex-row items-center rounded-2xl border-[1.5px] border-zinc-100 bg-white px-4 py-2.5 shadow-sm focus-within:border-[1.5px] focus-within:border-zinc-950">
            <form onSubmit={onSubmit} className="flex w-full items-center gap-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Message..."
                disabled={isLoading}
                rows={1}
                maxLength={8000}
                className="flex-1 max-h-40 min-h-[20px] resize-none border-0 bg-transparent px-1 py-0 text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-950 placeholder:text-zinc-400 selection:bg-zinc-900 selection:text-white"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const syntheticEvent = {
                      preventDefault: () => {},
                      currentTarget: e.currentTarget.form,
                    } as React.FormEvent<HTMLFormElement>;
                    onSubmit(syntheticEvent);
                  }
                }}
              />
              <div className="flex gap-1">
                <button
                  type="submit"
                  disabled={isLoading || !inputValue?.trim()}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent p-1.5 shadow-none hover:bg-zinc-100/90"
                >
                  <Send className="h-5 w-5 text-zinc-700" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-accent hover:bg-accent/90 text-white shadow-lg hover:shadow-xl transition-all z-50 flex items-center justify-center"
        aria-label="Toggle chat"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </button>
    </>
  );
}
