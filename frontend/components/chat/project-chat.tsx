import { useEffect, useRef, useState } from "react";

import { api, getApiBaseUrl, getToken } from "../../lib/api";
import { Hov } from "../infoboard/ui";

type ChatMessage = {
  id: string;
  project_id: string;
  sender_id: string;
  sender_email: string;
  content: string;
  created_at: string;
};

function buildWebSocketUrl(projectId: string, token: string): string {
  const url = new URL(getApiBaseUrl());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/projects/${encodeURIComponent(projectId)}`;
  url.search = `token=${encodeURIComponent(token)}`;
  return url.toString();
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "now";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ProjectChatPanel({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("connecting");
    setError("");
    setMessages([]);

    api
      .get<ChatMessage[]>(`/chat/${projectId}/messages`)
      .then((history) => {
        if (cancelled) return;
        setMessages(Array.isArray(history) ? history.slice().reverse() : []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load chat history.");
      });

    const token = getToken();
    if (!token) {
      setStatus("disconnected");
      setError("Sign in to use chat.");
      return () => {
        cancelled = true;
      };
    }

    const socket = new WebSocket(buildWebSocketUrl(projectId, token));
    socketRef.current = socket;

    socket.onopen = () => {
      if (cancelled) return;
      setStatus("connected");
      setError("");
    };

    socket.onmessage = (event) => {
      if (cancelled) return;
      try {
        const payload = JSON.parse(event.data) as { type?: string; detail?: string } & Partial<ChatMessage>;
        if (payload.type === "message" && payload.id && payload.content && payload.created_at) {
          setMessages((prev) => [...prev, payload as ChatMessage]);
        } else if (payload.type === "error" && payload.detail) {
          setError(payload.detail);
        }
      } catch {
        setError("Received an invalid chat event.");
      }
    };

    socket.onerror = () => {
      if (!cancelled) setError("Chat connection error.");
    };

    socket.onclose = () => {
      if (!cancelled) setStatus("disconnected");
    };

    return () => {
      cancelled = true;
      socketRef.current = null;
      socket.close();
    };
  }, [projectId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("Chat is not connected yet.");
      return;
    }

    setError("");
    socket.send(JSON.stringify({ type: "message", content: text }));
    setDraft("");
  };

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "calc(100vh - 60px)",
        padding: "30px 36px 36px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: "-.4px" }}>Chat</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8b8a83" }}>{projectName}</p>
        </div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            borderRadius: 999,
            padding: "6px 10px",
            color: status === "connected" ? "#1f8f4e" : "#8b5e00",
            background: status === "connected" ? "#edf8f1" : "#fff5db",
          }}
        >
          {status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected"}
        </div>
      </div>

      <div
        ref={listRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          background: "#fff",
          border: "1px solid #ebebe8",
          borderRadius: 14,
          padding: 18,
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 240,
              color: "#8b8a83",
              fontSize: 14,
            }}
          >
            No chat messages yet. Send the first one.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "76%",
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "#fafaf9",
                  border: "1px solid #ededea",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#5c5b57" }}>{message.sender_email.split("@")[0]}</span>
                  <span style={{ fontSize: 11.5, color: "#9b9a93" }}>{formatTime(message.created_at)}</span>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.5, color: "#37352f", whiteSpace: "pre-wrap" }}>
                  {message.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <div style={{ marginTop: 12, fontSize: 13, color: "#c0392b" }}>{error}</div>}

      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "flex-end",
          gap: 10,
          background: "#fff",
          border: "1px solid #ebebe8",
          borderRadius: 14,
          padding: 12,
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Write a message..."
          rows={2}
          style={{
            flex: 1,
            resize: "none",
            border: "1px solid #e3e3df",
            borderRadius: 10,
            padding: "10px 12px",
            fontSize: 14,
            color: "#37352f",
            outline: "none",
            fontFamily: "inherit",
          }}
        />
        <Hov
          as="button"
          onClick={sendMessage}
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            background: "#2f6fed",
            border: "none",
            borderRadius: 10,
            padding: "10px 16px",
            cursor: "pointer",
            minWidth: 88,
          }}
          hoverStyle={{ background: "#2560d8" }}
        >
          Send
        </Hov>
      </div>
    </section>
  );
}