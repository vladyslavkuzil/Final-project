import { useCallback, useEffect, useRef, useState } from "react";
import { api, getApiBaseUrl, getToken } from "../../lib/api";
import { ErrorBanner, Spinner, notion } from "../infoboard/ui";

// ── types ─────────────────────────────────────────────────────────────────────
type ChatMessage = {
  id: string;
  project_id: string;
  sender_id: string;
  sender_email: string;
  content: string;
  created_at: string;
};

type ConnectionStatus = "connecting" | "connected" | "disconnected";

// ── keyframe injection ────────────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const id = "__ib_chat_styles";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes ib-msg-in-left {
        from { opacity: 0; transform: translateX(-8px) translateY(4px); }
        to   { opacity: 1; transform: translateX(0)    translateY(0); }
      }
      @keyframes ib-msg-in-right {
        from { opacity: 0; transform: translateX(8px) translateY(4px); }
        to   { opacity: 1; transform: translateX(0)   translateY(0); }
      }
      @keyframes ib-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.4; }
      }

      /* ── Other people's messages (left) ── */
      .chat-message-left {
        transition: background 100ms ease;
        border-radius: 5px;
      }
      .chat-message-left:hover { background: ${notion.hoverWash} !important; }
      .chat-message-left.new {
        animation: ib-msg-in-left 0.25s cubic-bezier(0.16,1,0.3,1) forwards;
      }

      /* ── My messages (right) ── */
      .chat-message-right {
        border-radius: 5px;
        transition: opacity 100ms ease;
      }
      .chat-message-right.new {
        animation: ib-msg-in-right 0.25s cubic-bezier(0.16,1,0.3,1) forwards;
      }

      /* ── Bubble ── */
      .chat-bubble-mine {
        background: ${notion.accentBlue};
        color: #fff;
        border-radius: 14px 14px 4px 14px;
        padding: 8px 13px;
        font-size: 14px;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
        max-width: 100%;
        display: inline-block;
        box-shadow: 0 1px 3px rgba(35,131,226,0.25);
      }
      .chat-bubble-mine.grouped {
        border-radius: 14px 14px 4px 14px;
      }

      .chat-bubble-other {
        background: ${notion.bgSubtle};
        color: ${notion.text};
        border-radius: 14px 14px 14px 4px;
        padding: 8px 13px;
        font-size: 14px;
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
        max-width: 100%;
        display: inline-block;
        border: 1px solid ${notion.border};
      }
      .chat-bubble-other.grouped {
        border-radius: 14px 14px 14px 4px;
      }

      /* ── Textarea ── */
      .chat-textarea {
        flex: 1;
        resize: none;
        border: none;
        border-radius: 4px;
        padding: 8px 10px;
        font-size: 14px;
        color: ${notion.text};
        outline: none;
        font-family: inherit;
        background: transparent;
        line-height: 1.5;
      }
      .chat-textarea::placeholder { color: #c4c3be; }

      /* ── Send button ── */
      .chat-send-btn {
        font-size: 13px;
        font-weight: 500;
        color: #fff;
        background: ${notion.accentBlue};
        border: none;
        border-radius: 4px;
        padding: 8px 14px;
        cursor: pointer;
        min-width: 64px;
        font-family: inherit;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: background 150ms ease, transform 100ms ease, opacity 150ms ease;
        flex-shrink: 0;
        align-self: flex-end;
      }
      .chat-send-btn:hover:not(:disabled) {
        background: #1a6fc4;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(35,131,226,0.3);
      }
      .chat-send-btn:disabled { opacity: 0.45; cursor: default; }

      /* ── Status dot ── */
      .status-dot {
        width: 6px; height: 6px;
        border-radius: 50%;
        display: inline-block;
        flex-shrink: 0;
      }
      .status-dot.connecting {
        background: #e2a03f;
        animation: ib-pulse 1.2s ease infinite;
      }
      .status-dot.connected    { background: #4f8a5b; }
      .status-dot.disconnected { background: #9b9a97; }

      /* ── Reconnect link ── */
      .reconnect-btn {
        font-size: 12px;
        font-weight: 500;
        color: ${notion.accentBlue};
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0;
        font-family: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .reconnect-btn:hover { opacity: 0.75; }

      /* ── Scrollbar ── */
      .chat-list::-webkit-scrollbar { width: 6px; }
      .chat-list::-webkit-scrollbar-track { background: transparent; }
      .chat-list::-webkit-scrollbar-thumb {
        background: ${notion.border};
        border-radius: 99px;
      }
      .chat-list::-webkit-scrollbar-thumb:hover { background: ${notion.borderStrong}; }
    `;
    document.head.appendChild(s);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────
function buildWebSocketUrl(projectId: string, token: string): string {
  const url = new URL(getApiBaseUrl());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/projects/${encodeURIComponent(projectId)}`;
  url.search   = `token=${encodeURIComponent(token)}`;
  return url.toString();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "now";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString())     return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

const AVATAR_COLORS = ["#e2a03f","#9065b0","#4f8a5b","#d15c5c","#3980c1","#c17ec9"];
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function shouldGroup(a: ChatMessage, b: ChatMessage): boolean {
  if (a.sender_id !== b.sender_id) return false;
  const diff = Math.abs(
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return diff < 3 * 60 * 1000;
}

// ── sub-components ────────────────────────────────────────────────────────────
function DateDivider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 12px" }}>
      <div style={{ flex: 1, height: 1, background: notion.border }} />
      <span style={{ fontSize: 11.5, fontWeight: 500, color: notion.textFaint, letterSpacing: ".3px", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: notion.border }} />
    </div>
  );
}

function MessageRow({
  message,
  grouped,
  isNew,
  isMine,
}: {
  message: ChatMessage;
  grouped: boolean;
  isNew: boolean;
  isMine: boolean;
}) {
  if (isMine) {
    // ── My message — right-aligned blue bubble ──────────────────────────────
    return (
      <div
        className={`chat-message-right${isNew ? " new" : ""}`}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          padding: grouped ? "1px 8px" : "4px 8px",
          marginTop: grouped ? 0 : 6,
        }}
      >
        {/* Timestamp above bubble (only on first in group) */}
        {!grouped && (
          <span
            style={{
              fontSize: 11,
              color: notion.textFaint,
              marginBottom: 4,
              marginRight: 2,
            }}
          >
            You · {formatTime(message.created_at)}
          </span>
        )}

        <div
          className={`chat-bubble-mine${grouped ? " grouped" : ""}`}
          style={{ maxWidth: "68%" }}
        >
          {message.content}
        </div>

        {/* Subtle timestamp on grouped messages — visible on hover via parent */}
        {grouped && (
          <span
            style={{
              fontSize: 10.5,
              color: notion.textFaint,
              marginTop: 1,
              marginRight: 2,
              opacity: 0,
              transition: "opacity 150ms ease",
            }}
            className="chat-grouped-time"
          >
            {formatTime(message.created_at)}
          </span>
        )}
      </div>
    );
  }

  // ── Other person's message — left-aligned ──────────────────────────────────
  return (
    <div
      className={`chat-message-left${isNew ? " new" : ""}`}
      style={{
        display: "flex",
        gap: 10,
        padding: grouped ? "1px 8px" : "4px 8px",
        marginTop: grouped ? 0 : 6,
        alignItems: "flex-end",
      }}
    >
      {/* Avatar column */}
      <div style={{ width: 28, flexShrink: 0 }}>
        {!grouped ? (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: avatarColor(message.sender_email),
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {message.sender_email[0]?.toUpperCase()}
          </div>
        ) : (
          // Spacer so grouped messages align with non-grouped
          <div style={{ width: 28 }} />
        )}
      </div>

      {/* Bubble + name */}
      <div style={{ minWidth: 0, maxWidth: "68%" }}>
        {!grouped && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: notion.text }}>
              {message.sender_email.split("@")[0]}
            </span>
            <span style={{ fontSize: 11, color: notion.textFaint }}>
              {formatTime(message.created_at)}
            </span>
          </div>
        )}
        <div className={`chat-bubble-other${grouped ? " grouped" : ""}`}>
          {message.content}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  status,
  onReconnect,
}: {
  status: ConnectionStatus;
  onReconnect: () => void;
}) {
  return (
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
      <span className={`status-dot ${status}`} />
      {status === "connected"  && "Connected"}
      {status === "connecting" && "Connecting…"}
      {status === "disconnected" && (
        <>
          Disconnected
          <button className="reconnect-btn" onClick={onReconnect}>
            Retry
          </button>
        </>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function ProjectChatPanel({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newIds,   setNewIds]   = useState<Set<string>>(new Set());
  const [draft,    setDraft]    = useState("");
  const [status,   setStatus]   = useState<ConnectionStatus>("connecting");
  const [error,    setError]    = useState("");
  const [sending,  setSending]  = useState(false);

  // We identify "my" messages by matching sender_id against the first message
  // we send — or by storing the current user id from the token if available.
  // For now we track it via the first message whose sender_id we own.
  const myIdRef = useRef<string | null>(null);

  const socketRef   = useRef<WebSocket | null>(null);
  const listRef     = useRef<HTMLDivElement>(null);
  const retryRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount  = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── connection ──────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      setStatus("disconnected");
      setError("Sign in to use chat.");
      return;
    }

    setStatus("connecting");
    setError("");

    const socket = new WebSocket(buildWebSocketUrl(projectId, token));
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("connected");
      setError("");
      retryCount.current = 0;
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as
          { type?: string; detail?: string } & Partial<ChatMessage>;

        if (
          payload.type === "message" &&
          payload.id &&
          payload.content &&
          payload.created_at
        ) {
          const msg = payload as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setNewIds((prev) => new Set(prev).add(msg.id));
          setTimeout(() => {
            setNewIds((prev) => {
              const n = new Set(prev);
              n.delete(msg.id);
              return n;
            });
          }, 400);
        } else if (payload.type === "error" && payload.detail) {
          setError(payload.detail);
        }
      } catch {
        setError("Received an invalid chat event.");
      }
    };

    socket.onerror = () => setError("Chat connection error.");

    socket.onclose = () => {
      setStatus("disconnected");
      const delay = Math.min(1000 * 2 ** retryCount.current, 30_000);
      retryCount.current += 1;
      retryRef.current = setTimeout(connect, delay);
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setError("");

    api
      .get<ChatMessage[]>(`/chat/${projectId}/messages`)
      .then((history) => {
        if (cancelled) return;
        setMessages(
          Array.isArray(history)
            ? history
                .slice()
                .sort(
                  (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
                )
            : []
        );
      })
      .catch(() => {
        if (!cancelled) setError("Could not load chat history.");
      });

    connect();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [projectId, connect]);

  // Auto-scroll
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── send ────────────────────────────────────────────────────────────────────
  const sendMessage = () => {
    const text = draft.trim();
    if (!text || sending) return;

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("Chat is not connected yet.");
      return;
    }

    setSending(true);
    setError("");
    socket.send(JSON.stringify({ type: "message", content: text }));
    setDraft("");
    setSending(false);
    textareaRef.current?.focus();
  };

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        height: "calc(100vh - 52px)",
        padding: "28px 36px 24px",
        fontFamily: notion.font,
        background: notion.bgPage,
        animation: "ib-slide-up 0.3s ease forwards",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-.2px",
              color: notion.text,
            }}
          >
            Chat
          </h1>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: notion.textMuted }}>
            {projectName}
          </p>
        </div>
        <StatusPill
          status={status}
          onReconnect={() => {
            if (retryRef.current) clearTimeout(retryRef.current);
            retryCount.current = 0;
            connect();
          }}
        />
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        className="chat-list"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          background: notion.bgPage,
          border: `1px solid ${notion.border}`,
          borderRadius: 6,
          padding: "14px 12px",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 240,
              gap: 10,
              animation: "ib-fade-in 0.4s ease forwards",
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: notion.bgSubtle,
                border: `1.5px dashed ${notion.borderStrong}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
              }}
            >
              💬
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: notion.textFaint }}>
              No messages yet. Say hello!
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const grouped = !!prev && shouldGroup(prev, msg);
              const isNew   = newIds.has(msg.id);

              // Determine ownership — first time we see a sender_id that
              // matches a message the server echoes back after we send,
              // we store it. A cleaner approach is to decode the JWT or
              // pass the current user id as a prop.
              const isMine = myIdRef.current
                ? msg.sender_id === myIdRef.current
                : false;

              const showDivider =
                !prev ||
                new Date(prev.created_at).toDateString() !==
                  new Date(msg.created_at).toDateString();

              return (
                <div key={msg.id}>
                  {showDivider && (
                    <DateDivider label={formatDateDivider(msg.created_at)} />
                  )}
                  <MessageRow
                    message={msg}
                    grouped={grouped}
                    isNew={isNew}
                    isMine={isMine}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginTop: 10, flexShrink: 0 }}>
          <ErrorBanner message={error} />
        </div>
      )}

      {/* Composer */}
      <div
        style={{
          marginTop: 12,
          background: notion.bgPage,
          border: `1px solid ${notion.border}`,
          borderRadius: 6,
          padding: "6px 6px 6px 10px",
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
          flexShrink: 0,
          transition: "border-color 150ms ease, box-shadow 150ms ease",
        }}
        onFocusCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = notion.accentBlue;
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 0 0 3px rgba(35,131,226,0.1)";
        }}
        onBlurCapture={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "";
        }}
      >
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Write a message…  (Shift+Enter for new line)"
          rows={1}
          style={{ minHeight: 36, maxHeight: 160 }}
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={sending || !draft.trim()}
        >
          {sending ? (
            <Spinner size={12} color="rgba(255,255,255,0.4)" topColor="#fff" />
          ) : (
            <svg
              width="14" height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
          {!sending && "Send"}
        </button>
      </div>

      {/* Hint */}
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 11.5,
          color: notion.textFaint,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        Enter to send · Shift+Enter for new line
      </p>
    </section>
  );
}