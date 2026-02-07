"use client";

import { useState, useRef, useEffect } from "react";
import { useBuildStore } from "@/lib/store";
import { sendChatMessage } from "@/lib/api";
import { Button } from "@/components/ui";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChatSidebar() {
  const chatMessages = useBuildStore((s) => s.chatMessages);
  const addChatMessage = useBuildStore((s) => s.addChatMessage);
  const projectId = useBuildStore((s) => s.projectId);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput("");
    addChatMessage({ role: "user", content: userMsg });
    setIsSending(true);

    try {
      const response = await sendChatMessage(projectId || "demo", userMsg);
      addChatMessage(response);
    } catch {
      addChatMessage({
        role: "assistant",
        content:
          "Sorry, I couldn't connect to the server. Make sure the backend is running on port 8000.",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center gap-2">
        <div className="w-8 h-8 bg-teal-900/50 border border-teal-800 rounded-full flex items-center justify-center">
          <span className="text-sm">🤖</span>
        </div>
        <div>
          <h3 className="font-semibold text-sm text-white">Forecast Buddy</h3>
          <p className="text-xs text-teal-500">Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm",
              msg.role === "user"
                ? "ml-auto bg-teal-600 text-white rounded-br-md"
                : "bg-slate-800 border border-slate-700 text-slate-300 rounded-bl-md"
            )}
          >
            {msg.content}
          </div>
        ))}
        {isSending && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-slate-500 max-w-[90%]">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Ask the Buddy..."
            className="flex-1 rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
