"use client";

/**
 * WorkflowBuilderChat — chat panel for the workflow builder.
 * Reuses ScoutBubble, UserBubble, ThinkingIndicator from Scout.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Sparkles } from "lucide-react";
import { ScoutBubble, UserBubble, ThinkingIndicator } from "@/components/scout";
import type { BuilderMessage } from "@/types/workflow-builder";

const PROMPT_CHIPS = [
  "Rebuild a Franchise Tether automation",
  "Appointment reminder sequence",
  "New lead follow-up drip",
  "Post-call follow-up workflow",
];

interface WorkflowBuilderChatProps {
  messages: BuilderMessage[];
  isThinking: boolean;
  onSend: (message: string) => void;
}

export default function WorkflowBuilderChat({ messages, isThinking, onSend }: WorkflowBuilderChatProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  function handleSend() {
    const trimmed = inputValue.trim();
    if (!trimmed || isThinking) return;
    setInputValue("");
    onSend(trimmed);
  }

  const isHeroState = messages.length === 0;

  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {isHeroState ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-scout-bubble-bg border border-scout-bubble-border flex items-center justify-center mb-4">
              <Sparkles size={24} className="text-scout-purple" />
            </div>
            <h2 className="text-heading-md text-text-primary mb-2">Workflow Builder</h2>
            <p className="text-body-sm text-text-secondary max-w-[360px] mb-8">
              Describe what automation you need and Scout will help you build it.
            </p>

            {/* Prompt chips */}
            <div className="flex flex-wrap gap-2 justify-center max-w-[400px]">
              {PROMPT_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => onSend(chip)}
                  className="px-3 py-1.5 rounded-full bg-bg-tertiary border border-border-default text-body-sm text-text-secondary hover:text-text-primary hover:border-scout-purple/30 transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                {msg.role === "user" ? (
                  <UserBubble content={msg.content} timestamp={msg.id} />
                ) : (
                  <ScoutBubble content={msg.content} timestamp={msg.id} />
                )}
              </div>
            ))}
            {isThinking && <ThinkingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-border-default">
        <div className="flex items-center gap-2 bg-bg-secondary border border-border-default rounded-xl px-4 py-2 focus-within:border-scout-purple/50 transition-colors">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={isHeroState ? "Describe the workflow you need..." : "Describe changes or ask a question..."}
            className="flex-1 bg-transparent text-body-lg text-text-primary placeholder:text-text-tertiary outline-none"
            disabled={isThinking}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isThinking}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-scout-purple text-white flex items-center justify-center hover:bg-scout-purple/90 disabled:opacity-30 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
