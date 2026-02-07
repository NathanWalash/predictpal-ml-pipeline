"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useBuildStore } from "@/lib/store";
import { sendChatMessage } from "@/lib/api";
import { Button } from "@/components/ui";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

function usePageContext(): string {
  const currentStep = useBuildStore((s) => s.currentStep);
  const columns = useBuildStore((s) => s.columns);
  const numericColumns = useBuildStore((s) => s.numericColumns);
  const rowCount = useBuildStore((s) => s.rowCount);
  const dateCol = useBuildStore((s) => s.dateCol);
  const targetCol = useBuildStore((s) => s.targetCol);
  const frequency = useBuildStore((s) => s.frequency);
  const missingStrategy = useBuildStore((s) => s.missingStrategy);
  const outlierStrategy = useBuildStore((s) => s.outlierStrategy);
  const selectedLags = useBuildStore((s) => s.selectedLags);
  const horizon = useBuildStore((s) => s.horizon);
  const baselineModel = useBuildStore((s) => s.baselineModel);
  const multivariateModel = useBuildStore((s) => s.multivariateModel);
  const selectedDrivers = useBuildStore((s) => s.selectedDrivers);
  const uploadedFiles = useBuildStore((s) => s.uploadedFiles);
  const forecastResults = useBuildStore((s) => s.forecastResults);

  switch (currentStep) {
    case 1:
      return [
        "Page: Upload / Get Started (Step 1).",
        "The user is setting up their project and uploading data.",
        uploadedFiles.length
          ? `Uploaded file(s): ${uploadedFiles.join(", ")}.`
          : "No file uploaded yet.",
        rowCount ? `Dataset has ${rowCount} rows, ${columns.length} columns.` : "",
        numericColumns.length
          ? `Numeric columns detected: ${numericColumns.join(", ")}.`
          : "",
        "Help them understand CSV formatting, what columns are needed, and how to upload driver data.",
      ]
        .filter(Boolean)
        .join(" ");
    case 2:
      return [
        "Page: Process Data (Step 2).",
        "The user is configuring data cleaning and feature engineering.",
        dateCol ? `Date column: ${dateCol}.` : "No date column selected yet.",
        targetCol ? `Target column: ${targetCol}.` : "No target column selected yet.",
        frequency ? `Frequency: ${frequency}.` : "",
        missingStrategy ? `Missing-value strategy: ${missingStrategy}.` : "",
        outlierStrategy ? `Outlier strategy: ${outlierStrategy}.` : "",
        selectedLags.length ? `Lag features: ${selectedLags.join(", ")}.` : "",
        "Help them decide on imputation, outlier handling, and feature choices.",
      ]
        .filter(Boolean)
        .join(" ");
    case 3:
      return [
        "Page: Train & Forecast (Step 3).",
        "The user is selecting models and running the forecast.",
        `Horizon: ${horizon} periods.`,
        baselineModel ? `Baseline model: ${baselineModel}.` : "",
        multivariateModel ? `Multivariate model: ${multivariateModel}.` : "",
        selectedDrivers.length
          ? `Selected drivers: ${selectedDrivers.join(", ")}.`
          : "No drivers selected.",
        forecastResults
          ? "Forecast has been run - results are available."
          : "Forecast has not been run yet.",
        "Help them understand model choices, drivers, and training.",
      ]
        .filter(Boolean)
        .join(" ");
    case 4:
      return [
        "Page: Outputs / Report (Step 4).",
        "The user is viewing the forecast results and building their report.",
        forecastResults
          ? `Forecast generated with horizon ${forecastResults.horizon}. Drivers used: ${forecastResults.drivers_used?.join(", ") || "none"}.`
          : "No forecast results yet.",
        "Help them interpret charts, accuracy metrics, and feature importance.",
      ]
        .filter(Boolean)
        .join(" ");
    case 5:
      return [
        "Page: Showcase (Step 5).",
        "The user is finalising and publishing their project.",
        "Help them write a summary, pick tags, and understand sharing options.",
      ].join(" ");
    default:
      return "The user is using the Forecast Buddy no-code ML tool.";
  }
}

function useReportData(): string | null {
  const currentStep = useBuildStore((s) => s.currentStep);
  const forecastResults = useBuildStore((s) => s.forecastResults);

  if ((currentStep === 4 || currentStep === 5) && forecastResults) {
    try {
      return JSON.stringify(forecastResults);
    } catch {
      return null;
    }
  }

  return null;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const normalized = text
    // Gemini sometimes escapes markdown markers.
    .replace(/\\\*/g, "*")
    .replace(/\\_/g, "_")
    .replace(/\\`/g, "`");

  return normalized
    .split(/(\*\*.+?\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      const boldMatch = part.match(/^\*\*(.+?)\*\*$/);
      if (boldMatch) {
        return <strong key={index}>{boldMatch[1]}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
}

function renderMessageContent(content: string): ReactNode {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i];

    if (/^[-*]\s+/.test(current)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(current)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (!current.trim()) {
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
      i += 1;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="whitespace-pre-wrap">
        {renderInlineMarkdown(current)}
      </p>
    );
    i += 1;
  }

  return <div className="space-y-2">{blocks}</div>;
}

export default function ChatSidebar() {
  const chatMessages = useBuildStore((s) => s.chatMessages);
  const addChatMessage = useBuildStore((s) => s.addChatMessage);
  const projectId = useBuildStore((s) => s.projectId);

  const pageContext = usePageContext();
  const reportData = useReportData();

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput("");
    addChatMessage({ role: "user", content: userMsg });
    setIsSending(true);

    try {
      const history = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await sendChatMessage({
        project_id: projectId || "demo",
        message: userMsg,
        page_context: pageContext,
        history,
        report_data: reportData,
      });

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
  }, [input, chatMessages, projectId, pageContext, reportData, addChatMessage]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-800 p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-teal-800 bg-teal-900/50">
          <span className="text-sm">🤖</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Forecast Buddy</h3>
          <p className="text-xs text-teal-500">Online</p>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto p-4">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm",
              msg.role === "user"
                ? "ml-auto rounded-br-md bg-teal-600 text-white"
                : "rounded-bl-md border border-slate-700 bg-slate-800 text-slate-300"
            )}
          >
            {renderMessageContent(msg.content)}
          </div>
        ))}

        {isSending && (
          <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-500">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-800 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask the Buddy..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
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
