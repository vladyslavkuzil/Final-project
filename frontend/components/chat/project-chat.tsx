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
  // client-only state, never sent by the server
  _pending?: boolean;
  _failed?: boolean;
};

type ConnectionStatus = "connecting" | "connected" | "disconnected";

const MAX_MESSAGE_LENGTH = 4000;
const PENDING_TIMEOUT_MS = 10_000;

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

      @media (prefers-reduced-motion: reduce) {
        .chat-message-left.new,
        .chat-message-right.new {
          animation: none !important;
        }
        .status-dot.connecting {
          animation: none !important;
        }
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
      .chat-message-right:hover .chat-grouped-time {
        opacity: 1 !important;
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
        transition: opacity 150ms ease;
      }
      .chat-bubble-mine.grouped {
        border-radius: 14px 14px 4px 14px;
      }
      .chat-bubble-mine.pending {
        opacity: 0.6;
      }
      .chat-bubble-mine.failed {
        background: ${notion.bgSubtle};
        color: ${notion.text};
        border: 1px solid #e2a03f;
        box-shadow: none;
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
        overflow-y: auto;
      }
      .chat-textarea::placeholder { color: #c4c3be; }
      .chat-textarea:disabled { cursor: not-allowed; opacity: 0.6; }

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

      /* ── Focus visibility (a11y) ── */
      .chat-send-btn:focus-visible,
      .reconnect-btn:focus-visible,
      .chat-retry-btn:focus-visible,
      .chat-scroll-btn:focus-visible {
        outline: 2px solid ${notion.accentBlue};
        outline-offset: 2px;
      }
      .chat-textarea:focus-visible {
        outline: none;
      }

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

      .chat-retry-btn {
        font-size: 11px;
        font-weight: 600;
        color: #b5720b;
        background: transparent;
        border: none;
        cursor: pointer;
        padding: 0;
        font-family: inherit;
        text-decoration: underline;
        text-underline-offset: 2px;
        margin-top: 2px;
      }

      /* ── Scroll-to-bottom button ── */
      .chat-scroll-btn {
        position: absolute;
        bottom: 14px;
        right: 14px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 1px solid ${notion.border};
        background: #fff;
        color: ${notion.textMuted};
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(15,15,15,0.1);
        transition: transform 100ms ease, background 100ms ease;
      }
      .chat-scroll-btn:hover { transform: translateY(-1px); background: ${notion.bgSubtle}; }

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
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ??
    `${window.location.origin}/api`;

  const url = new URL(apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/api/ws/projects/${encodeURIComponent(projectId)}`;
  url.search = `token=${encodeURIComponent(token)}`;

  return url.toString();
}

// Best-effort decode of the JWT payload to recover the current user's id.
// Falls back gracefully (returns null) for opaque/non-JWT tokens — the app
// still works correctly without this, via the optimistic-send tracking below.
function decodeJwtUserId(token: string): string | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(json) as Record<string, unknown>;
    const candidate =
      payload.sub ?? payload.user_id ?? payload.id ?? payload.uid;
    return typeof candidate === "string" ? candidate : null;
  } catch {
    return null;
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "now";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const AVATAR_COLORS = [
  "#e2a03f",
  "#9065b0",
  "#4f8a5b",
  "#d15c5c",
  "#3980c1",
  "#c17ec9",
];
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function shouldGroup(a: ChatMessage, b: ChatMessage): boolean {
  if (a.sender_id !== b.sender_id) return false;
  const diff = Math.abs(
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  return diff < 3 * 60 * 1000;
}

function genTempId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── sub-components ────────────────────────────────────────────────────────────
function DateDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "16px 0 12px",
      }}
    >
      <div style={{ flex: 1, height: 1, background: notion.border }} />
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 500,
          color: notion.textFaint,
          letterSpacing: ".3px",
          whiteSpace: "nowrap",
        }}
      >
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
  onRetry,
}: {
  message: ChatMessage;
  grouped: boolean;
  isNew: boolean;
  isMine: boolean;
  onRetry: (tempId: string) => void;
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
            You ·{" "}
            {message._failed ? "not sent" : formatTime(message.created_at)}
          </span>
        )}

        <div
          className={`chat-bubble-mine${grouped ? " grouped" : ""}${message._pending ? " pending" : ""}${message._failed ? " failed" : ""}`}
          style={{ maxWidth: "68%" }}
        >
          {message.content}
        </div>

        {message._failed && (
          <button
            type="button"
            className="chat-retry-btn"
            onClick={() => onRetry(message.id)}
          >
            Couldn't send · Retry
          </button>
        )}

        {/* Subtle timestamp on grouped messages — visible on hover of the row */}
        {grouped && !message._failed && (
          <span
            className="chat-grouped-time"
            style={{
              fontSize: 10.5,
              color: notion.textFaint,
              marginTop: 1,
              marginRight: 2,
              opacity: 0,
              transition: "opacity 150ms ease",
            }}
          >
            {message._pending ? "Sending…" : formatTime(message.created_at)}
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
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              marginBottom: 4,
            }}
          >
            <span
              style={{ fontSize: 12.5, fontWeight: 600, color: notion.text }}
            >
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
      role="status"
      aria-live="polite"
    >
      <span className={`status-dot ${status}`} />
      {status === "connected" && "Connected"}
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
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [error, setError] = useState("");
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  // Ids of messages authored by the current user — populated both from the
  // decoded auth token (works across devices/tabs) and from confirmed sends
  // (works even if the token can't be decoded).
  const [ownIds, setOwnIds] = useState<Set<string>>(new Set());
  const myIdRef = useRef<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // tempId -> timeout handle, so we can mark a pending send as failed if it's
  // never echoed back within PENDING_TIMEOUT_MS.
  const pendingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // ── connection ──────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      setStatus("disconnected");
      setError("Sign in to use chat.");
      return;
    }

    myIdRef.current = decodeJwtUserId(token);

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
        const payload = JSON.parse(event.data) as {
          type?: string;
          detail?: string;
        } & Partial<ChatMessage>;

        if (
          payload.type === "message" &&
          payload.id &&
          payload.content &&
          payload.created_at
        ) {
          const msg = payload as ChatMessage;

          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;

            // If this echoes a message we just sent optimistically, replace
            // the pending placeholder instead of appending a duplicate.
            const pendingIdx = prev.findIndex(
              (m) =>
                m._pending &&
                m.content === msg.content &&
                m.id.startsWith("pending-"),
            );
            if (pendingIdx !== -1) {
              const tempId = prev[pendingIdx].id;
              const timer = pendingTimersRef.current.get(tempId);
              if (timer) clearTimeout(timer);
              pendingTimersRef.current.delete(tempId);

              setOwnIds((ids) => {
                const next = new Set(ids);
                next.delete(tempId);
                next.add(msg.id);
                return next;
              });

              const copy = prev.slice();
              copy[pendingIdx] = msg;
              return copy;
            }

            if (myIdRef.current && msg.sender_id === myIdRef.current) {
              setOwnIds((ids) => new Set(ids).add(msg.id));
            }

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

      // Any message still pending when the socket drops has no chance of
      // being echoed back — surface it as failed immediately rather than
      // waiting out the timeout.
      setMessages((prev) =>
        prev.map((m) =>
          m._pending ? { ...m, _pending: false, _failed: true } : m,
        ),
      );
      pendingTimersRef.current.forEach((t) => clearTimeout(t));
      pendingTimersRef.current.clear();

      const delay = Math.min(1000 * 2 ** retryCount.current, 30_000);
      retryCount.current += 1;
      retryRef.current = setTimeout(connect, delay);
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setOwnIds(new Set());
    setError("");

    api
      .get<ChatMessage[]>(`/chat/${projectId}/messages`)
      .then((history) => {
        if (cancelled) return;
        const sorted = Array.isArray(history)
          ? history
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              )
          : [];
        setMessages(sorted);
        if (myIdRef.current) {
          setOwnIds(
            new Set(
              sorted
                .filter((m) => m.sender_id === myIdRef.current)
                .map((m) => m.id),
            ),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load chat history.");
      });

    connect();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      pendingTimersRef.current.forEach((t) => clearTimeout(t));
      pendingTimersRef.current.clear();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [projectId, connect]);

  // Auto-scroll, and surface a "jump to latest" affordance when scrolled up.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setShowJumpToLatest(false);
    } else {
      setShowJumpToLatest(true);
    }
  }, [messages]);

  const handleListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShowJumpToLatest(!isNearBottom);
  };

  const jumpToLatest = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setShowJumpToLatest(false);
  };

  // Auto-grow the textarea with content, capped by CSS max-height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  // ── send ────────────────────────────────────────────────────────────────────
  const dispatchSend = useCallback((tempId: string, text: string) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId ? { ...m, _pending: false, _failed: true } : m,
        ),
      );
      setError("Chat is not connected yet.");
      return;
    }

    socket.send(JSON.stringify({ type: "message", content: text }));

    const timer = setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId && m._pending
            ? { ...m, _pending: false, _failed: true }
            : m,
        ),
      );
      pendingTimersRef.current.delete(tempId);
    }, PENDING_TIMEOUT_MS);
    pendingTimersRef.current.set(tempId, timer);
  }, []);

  const sendMessage = () => {
    const text = draft.trim();
    if (!text) return;

    if (text.length > MAX_MESSAGE_LENGTH) {
      setError(
        `Message is too long (max ${MAX_MESSAGE_LENGTH.toLocaleString()} characters).`,
      );
      return;
    }

    setError("");

    const tempId = genTempId();
    const optimisticMessage: ChatMessage = {
      id: tempId,
      project_id: projectId,
      sender_id: myIdRef.current ?? "me",
      sender_email: "you",
      content: text,
      created_at: new Date().toISOString(),
      _pending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setOwnIds((ids) => new Set(ids).add(tempId));
    setDraft("");
    textareaRef.current?.focus();

    dispatchSend(tempId, text);
  };

  const retrySend = (tempId: string) => {
    const failed = messages.find((m) => m.id === tempId);
    if (!failed) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId ? { ...m, _pending: true, _failed: false } : m,
      ),
    );
    setError("");
    dispatchSend(tempId, failed.content);
  };

  const remaining = MAX_MESSAGE_LENGTH - draft.length;
  const showCounter = remaining < 200;
  const composerDisabled = status !== "connected";

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
          <p
            style={{ margin: "2px 0 0", fontSize: 13, color: notion.textMuted }}
          >
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
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <div
          ref={listRef}
          className="chat-list"
          onScroll={handleListScroll}
          style={{
            height: "100%",
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
                const isNew = newIds.has(msg.id);
                const isMine = ownIds.has(msg.id);

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
                      onRetry={retrySend}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showJumpToLatest && messages.length > 0 && (
          <button
            type="button"
            className="chat-scroll-btn"
            onClick={jumpToLatest}
            aria-label="Jump to latest messages"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
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
          (e.currentTarget as HTMLDivElement).style.borderColor =
            notion.accentBlue;
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
          placeholder={
            composerDisabled
              ? "Reconnecting…"
              : "Write a message…  (Shift+Enter for new line)"
          }
          rows={1}
          disabled={composerDisabled}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label="Message"
          style={{ minHeight: 36, maxHeight: 160 }}
        />
        <button
          className="chat-send-btn"
          onClick={sendMessage}
          disabled={composerDisabled || !draft.trim()}
          aria-label="Send message"
        >
          <svg
            width="14"
            height="14"
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
          Send
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
        {showCounter
          ? `${remaining} characters left`
          : "Enter to send · Shift+Enter for new line"}
      </p>
    </section>
  );
}
