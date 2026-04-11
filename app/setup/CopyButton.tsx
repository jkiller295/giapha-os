"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useState } from "react";

export default function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      setError("Không thể copy. Trình duyệt của bạn có thể không hỗ trợ tính năng này.");
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div className="w-full">
      <button
        onClick={handleCopy}
        className={`w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-bold transition-all duration-300 shadow-sm ${
          copied
            ? "bg-teal-500 hover:bg-teal-600 text-white"
            : "bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md"
        }`}
      >
        {copied ? (
          <>
            <Check className="size-5" />
            Đã Copy thành công!
          </>
        ) : (
          <>
            <ClipboardCopy className="size-5" />
            Copy Mã SQL
          </>
        )}
      </button>
      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2 justify-center animate-in fade-in slide-in-from-top-1">
          {error}
        </div>
      )}
    </div>
  );
}
