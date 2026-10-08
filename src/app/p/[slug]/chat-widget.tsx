"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Alert, Button, Card, cx, Input } from "@/components/ui";
import { sendChatMessage } from "./chat-actions";

type Msg = { role: "user" | "assistant"; content: string };

export function ChatWidget({ slug, source, agentName }: { slug: string; source: "facebook" | "website"; agentName: string }) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, pending]);

  function send(e: FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || pending) return;
    setText("");
    setError(undefined);
    const next = [...messages, { role: "user" as const, content: message }];
    setMessages(next);
    startTransition(async () => {
      const res = await sendChatMessage({ slug, chatId, message, source });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const all = [...next, { role: "assistant" as const, content: res.reply }];
      setChatId(res.chatId);
      setMessages(all);
    });
  }

  return (
    <Card className="p-0" data-testid="buyer-chat">
      <div className="border-b border-zinc-100 px-4 py-3">
        <h2 className="font-semibold">💬 Ask about this property</h2>
        <p className="text-xs text-zinc-500">AI assistant for {agentName || "the agent"} · answers come from the listing details</p>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite">
        <p className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-100 px-3 py-2 text-sm">
          Hi! 👋 Ask me anything about this property — price, size, location, or schedule a viewing.
        </p>
        {messages.map((m, i) => (
          <p
            key={i}
            data-testid={`chat-${m.role}`}
            className={cx(
              "w-fit max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm",
              m.role === "user" ? "ml-auto rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-zinc-100",
            )}
          >
            {m.content}
          </p>
        ))}
        {pending && <p className="w-fit rounded-2xl bg-zinc-100 px-3 py-2 text-sm text-zinc-500">Typing…</p>}
        <div ref={endRef} />
      </div>
      {error && (
        <div className="px-4 pb-2">
          <Alert tone="warning">{error}</Alert>
        </div>
      )}
      <form onSubmit={send} className="flex gap-2 border-t border-zinc-100 p-3">
        <Input
          aria-label="Your message"
          placeholder="Type your question…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !text.trim()}>
          Send
        </Button>
      </form>
    </Card>
  );
}
