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
 
// --- Notion-style design tokens -------------------------------------
// Keep these local to the file for now; move to a shared theme file
// once you're happy with them and want to reuse across components.
const notion = {
  text: "#37352f",
  textMuted: "#787774",
  textFaint: "#9b9a97",
  border: "rgba(55, 53, 47, 0.09)",
  borderStrong: "rgba(55, 53, 47, 0.16)",
  hoverWash: "rgba(55, 53, 47, 0.08)",
  bgPage: "#ffffff",
  bgSidebar: "#fbfbfa",
  bgSubtle: "#f7f6f3",
  accentBlue: "#2383e2", // Notion's actual link/accent blue
  font:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
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
 
// Small helper so every avatar gets a consistent, deterministic color
// the way Notion assigns member colors — not random per render.
const AVATAR_COLORS = ["#e2a03f", "#9065b0", "#4f8a5b", "#d15c5c", "#3980c1", "#c17ec9"];
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
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
        fontFamily: notion.font,
        background: notion.bgPage,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-.2px", color: notion.text }}>
            Chat
          </h1>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: notion.textMuted }}>{projectName}</p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 500,
            borderRadius: 4,
            padding: "4px 8px",
            color: notion.textMuted,
            background: notion.bgSubtle,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: status === "connected" ? "#4f8a5b" : status === "connecting" ? "#e2a03f" : "#9b9a97",
              display: "inline-block",
            }}
          />
          {status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected"}
        </div>
      </div>
 
      {/* Notion panels: flat fill + hairline border, no shadow, small radius */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          background: notion.bgPage,
          border: `1px solid ${notion.border}`,
          borderRadius: 6,
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
              color: notion.textFaint,
              fontSize: 14,
            }}
          >
            No chat messages yet. Send the first one.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "6px 8px",
                  borderRadius: 4,
                  transition: "background 100ms ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = notion.hoverWash)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div
                  style={{
                    flexShrink: 0,
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: avatarColor(message.sender_email),
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 2,
                  }}
                >
                  {message.sender_email[0]?.toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: notion.text }}>
                      {message.sender_email.split("@")[0]}
                    </span>
                    <span style={{ fontSize: 11.5, color: notion.textFaint }}>{formatTime(message.created_at)}</span>
                  </div>
                  <p
                    style={{
                      margin: "1px 0 0",
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: notion.text,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {message.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
 
      {error && (
        <div style={{ marginTop: 12, fontSize: 13, color: "#eb5757" }}>
          {error}
        </div>
      )}
 
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: notion.bgPage,
          border: `1px solid ${notion.border}`,
          borderRadius: 6,
          padding: 8,
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
            border: "none",
            borderRadius: 4,
            padding: "8px 10px",
            fontSize: 14,
            color: notion.text,
            outline: "none",
            fontFamily: "inherit",
            background: "transparent",
          }}
        />
        <Hov
          as="button"
          onClick={sendMessage}
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#fff",
            background: "#191919",
            border: "none",
            borderRadius: 4,
            padding: "8px 14px",
            cursor: "pointer",
            minWidth: 76,
          }}
          hoverStyle={{ background: "#000000" }}
        >
          Send
        </Hov>
      </div>
    </section>
  );
}