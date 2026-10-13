import React, { useState, useEffect } from 'react';
import { X, Send, ArrowRight, Compass, HelpCircle, Trash2 } from 'lucide-react';
import { AssistantChatMessage, AssistantChatResponse } from '../types';
import { sendAssistantChat, api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ModelSwitcherPill } from './ModelSwitcherPill';

interface AssistantChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyQuery: (query: string, yearMin?: number, yearMax?: number, threshold?: number) => void;
}

export const AssistantChatDrawer: React.FC<AssistantChatDrawerProps> = ({
  isOpen,
  onClose,
  onApplyQuery,
}) => {
  const { activeProvider, activeModel, runtimeKeys, token, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => {
    try {
      const cached = localStorage.getItem('researchloom_copilot_chat');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        role: 'assistant',
        content:
          'Hello. I am your ResearchLoom (Samhita) Copilot. Describe your research focus or rough thesis questions in everyday terms, and I will help refine the scope and formulate precise academic search queries.',
      },
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [latestResponse, setLatestResponse] = useState<AssistantChatResponse | null>(null);

  // Synchronize Copilot conversation to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('researchloom_copilot_chat', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const handleClearCopilot = () => {
    if (window.confirm('Reset Copilot conversation?')) {
      const initial: AssistantChatMessage[] = [
        {
          role: 'assistant',
          content:
            'Hello. I am your ResearchLoom (Samhita) Copilot. Describe your research focus or rough thesis questions in everyday terms, and I will help refine the scope and formulate precise academic search queries.',
        },
      ];
      setMessages(initial);
      try {
        localStorage.removeItem('researchloom_copilot_chat');
      } catch {}
    }
  };

  if (!isOpen) return null;

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMessage: AssistantChatMessage = {
      role: 'user',
      content: inputText.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await sendAssistantChat({
        messages: newMessages,
        model_provider: activeProvider,
        model_name: activeModel,
        groq_api_key: runtimeKeys.groq,
        gemini_api_key: runtimeKeys.gemini,
        openrouter_api_key: runtimeKeys.openrouter,
        deepseek_api_key: runtimeKeys.deepseek,
        nvidia_api_key: runtimeKeys.nvidia
      });

      setLatestResponse(response);
      const updatedMessages = [
        ...newMessages,
        {
          role: 'assistant' as const,
          content: response.assistant_reply,
        },
      ];
      setMessages(updatedMessages);

      if (token && isAuthenticated) {
        api.saveChatHistory(
          token,
          userMessage.content.slice(0, 40) + '...',
          updatedMessages
        ).catch(() => {});
      }
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          role: 'assistant',
          content: `Issue encountered: ${err.message || 'Please check your API key configuration.'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (query: string) => {
    onApplyQuery(
      query,
      latestResponse?.suggested_year_min,
      latestResponse?.suggested_year_max,
      latestResponse?.recommended_threshold
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg dark:bg-[#1e1f20] bg-white border-l dark:border-[#3c4043] border-slate-200 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b dark:border-[#3c4043] border-slate-200 flex items-center justify-between dark:bg-[#18191a] bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#8ab4f8]/15 text-[#8ab4f8] flex items-center justify-center border border-[#8ab4f8]/30">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm dark:text-[#e3e3e3] text-slate-900">
                  ResearchLoom Copilot
                </h3>
                <p className="text-[11px] dark:text-[#9aa0a6] text-[#5f6368]">
                  Research Formulation & Academic Translation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ModelSwitcherPill />
              <button
                type="button"
                onClick={handleClearCopilot}
                className="p-1.5 rounded-lg dark:text-[#9aa0a6] text-slate-400 hover:text-[#f28b82] hover:dark:bg-[#282a2c] hover:bg-slate-200 transition-colors"
                title="Reset Copilot conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg dark:text-[#9aa0a6] text-slate-400 hover:dark:text-white hover:text-black hover:dark:bg-[#282a2c] hover:bg-slate-200 transition-colors"
                title="Close Copilot"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#1a73e8] text-white rounded-tr-none'
                      : 'dark:bg-[#282a2c] bg-slate-100 dark:text-[#e3e3e3] text-slate-800 border dark:border-[#3c4043] border-slate-200 rounded-tl-none'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-[#8ab4f8] dark:bg-[#282a2c] bg-slate-100 p-3 rounded-2xl w-48 animate-pulse">
                <Compass className="w-3.5 h-3.5 animate-spin" />
                <span>Refining research scope...</span>
              </div>
            )}

            {/* Suggestions Panel */}
            {latestResponse && !isLoading && (
              <div className="mt-4 p-4 rounded-2xl dark:bg-[#282a2c] bg-blue-50/60 border dark:border-[#3c4043] border-blue-200 space-y-3 animate-fadeIn">
                {latestResponse.clarifying_questions.length > 0 && (
                  <div>
                    <h5 className="text-[11px] font-semibold dark:text-[#8ab4f8] text-[#1a73e8] uppercase tracking-wider mb-1 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Clarifying Angles</span>
                    </h5>
                    <ul className="list-disc list-inside space-y-1 dark:text-[#c4c7c5] text-slate-700 pl-1">
                      {latestResponse.clarifying_questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {latestResponse.suggested_queries.length > 0 && (
                  <div>
                    <h5 className="text-[11px] font-semibold dark:text-[#8ab4f8] text-[#1a73e8] uppercase tracking-wider mb-1.5">
                      Recommended Search Queries
                    </h5>
                    <div className="space-y-1.5">
                      {latestResponse.suggested_queries.map((sq, i) => (
                        <div
                          key={i}
                          className="dark:bg-[#1e1f20] bg-white border dark:border-[#3c4043] border-blue-100 p-2.5 rounded-xl flex items-center justify-between group transition-colors"
                        >
                          <span className="font-medium dark:text-[#e3e3e3] text-slate-900 pr-2">
                            "{sq}"
                          </span>
                          <button
                            type="button"
                            onClick={() => handleApply(sq)}
                            className="shrink-0 text-[11px] font-medium text-[#8ab4f8] hover:text-white bg-[#8ab4f8]/10 hover:bg-[#8ab4f8] px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
                          >
                            <span>Apply</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t dark:border-[#3c4043] border-slate-200 dark:bg-[#18191a] bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask research advice or clarify topic..."
              disabled={isLoading}
              className="flex-1 dark:bg-[#131314] bg-slate-50 border dark:border-[#3c4043] border-slate-300 rounded-full px-4 py-2 text-xs dark:text-[#e3e3e3] text-slate-900 placeholder-[#9aa0a6] focus:outline-none focus:border-[#8ab4f8]"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-2 bg-[#8ab4f8] text-[#131314] hover:bg-[#a8c7fa] disabled:opacity-40 rounded-full transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
