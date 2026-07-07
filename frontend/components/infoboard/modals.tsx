import React, { useEffect, useRef, useState } from "react";
import type { Project } from "../../lib/store";
import { Hov, Modal } from "./ui";

// ── design tokens ─────────────────────────────────────────────────────────────
const notion = {
  text: "#37352f",
  textMuted: "#787774",
  textFaint: "#9b9a97",
  border: "rgba(55, 53, 47, 0.09)",
  borderStrong: "rgba(55, 53, 47, 0.16)",
  hoverWash: "rgba(55, 53, 47, 0.08)",
  bgPage: "#ffffff",
  bgSubtle: "#f7f6f3",
  primary: "#191919",
  primaryHover: "#000000",
  danger: "#eb5757",
  toggleOn: "#22a559",
  toggleOff: "#d8d7d1",
  accentBlue: "#2383e2",
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
};

// ── keyframe injection ────────────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const id = "__notion_modal_styles";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes modalBackdropIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes modalCardIn {
        from { opacity: 0; transform: scale(0.97) translateY(6px); }
        to   { opacity: 1; transform: scale(1)    translateY(0); }
      }
      @keyframes errorSlide {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeSlideIn {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes checkPop {
        0%   { transform: scale(0); opacity: 0; }
        60%  { transform: scale(1.2); }
        100% { transform: scale(1); opacity: 1; }
      }

      .modal-backdrop {
        animation: modalBackdropIn 0.18s ease forwards;
      }
      .modal-card {
        animation: modalCardIn 0.22s cubic-bezier(0.16,1,0.3,1) forwards;
      }

      /* Field */
      .modal-input {
        display: block;
        width: 100%;
        box-sizing: border-box;
        padding: 8px 11px;
        font-size: 14px;
        font-family: inherit;
        color: #37352f;
        background: #f7f6f3;
        border: 1.5px solid rgba(55,53,47,0.09);
        border-radius: 5px;
        outline: none;
        resize: none;
        transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
      }
      .modal-input:focus {
        background: #fff;
        border-color: #2383e2;
        box-shadow: 0 0 0 3px rgba(35,131,226,0.12);
      }
      .modal-input::placeholder { color: #c4c3be; }
      .modal-input:-webkit-autofill {
        transition: background-color 9999s ease-in-out 0s;
        -webkit-text-fill-color: #37352f !important;
      }

      /* Buttons */
      .modal-btn-cancel {
        font-size: 13px; font-weight: 500;
        color: #37352f; background: #fff;
        border: 1px solid rgba(55,53,47,0.16);
        border-radius: 4px; padding: 7px 14px;
        cursor: pointer; font-family: inherit;
        transition: background 150ms ease;
      }
      .modal-btn-cancel:hover { background: #f7f6f3; }

      .modal-btn-confirm {
        font-size: 13px; font-weight: 500;
        color: #fff; background: #191919;
        border: none; border-radius: 4px;
        padding: 7px 16px; cursor: pointer;
        font-family: inherit; display: flex;
        align-items: center; gap: 7px;
        transition: background 150ms ease, transform 100ms ease, box-shadow 100ms ease;
      }
      .modal-btn-confirm:hover:not(:disabled) {
        background: #000;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      }
      .modal-btn-confirm:disabled { opacity: 0.55; cursor: default; }
    `;
    document.head.appendChild(s);
  }
}

// ── shared primitives ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 12,
        height: 12,
        border: "2px solid rgba(255,255,255,0.3)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin 0.65s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

function FieldLabel({
  children,
  required,
  optional,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: ".4px",
        textTransform: "uppercase",
        color: notion.textMuted,
        marginBottom: 6,
      }}
    >
      {children}
      {required && (
        <span style={{ color: notion.danger, marginLeft: 3 }}>*</span>
      )}
      {optional && (
        <span
          style={{
            fontWeight: 400,
            textTransform: "none",
            letterSpacing: 0,
            color: notion.textFaint,
            marginLeft: 5,
            fontSize: 11,
          }}
        >
          optional
        </span>
      )}
    </label>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "9px 12px",
        background: "rgba(235,87,87,0.07)",
        border: "1px solid rgba(235,87,87,0.22)",
        borderRadius: 5,
        marginBottom: 16,
        animation: "errorSlide 0.22s ease",
      }}
    >
      <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>⚠️</span>
      <p style={{ margin: 0, fontSize: 13, color: "#c0392b", lineHeight: 1.5 }}>
        {message}
      </p>
    </div>
  );
}

function ModalFooter({
  onClose,
  busy,
  confirmLabel,
  busyLabel,
  onConfirm,
}: {
  onClose: () => void;
  busy: boolean;
  confirmLabel: string;
  busyLabel: string;
  onConfirm: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 8,
        paddingTop: 6,
      }}
    >
      <button className="modal-btn-cancel" onClick={onClose}>
        Cancel
      </button>
      <button className="modal-btn-confirm" onClick={onConfirm} disabled={busy}>
        {busy && <Spinner />}
        {busy ? busyLabel : confirmLabel}
      </button>
    </div>
  );
}

// ── shared submit hook ────────────────────────────────────────────────────────
function useModalSubmit(
  action: () => Promise<void> | void,
  onClose: () => void,
  fallback: string,
) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await action();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : fallback;
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return { error, busy, submit };
}

// ── divider ───────────────────────────────────────────────────────────────────
function ModalDivider() {
  return (
    <div
      style={{
        height: 1,
        background: notion.border,
        margin: "18px -28px",
      }}
    />
  );
}

// ── New Project Modal ─────────────────────────────────────────────────────────
export function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, desc: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const { error, busy, submit } = useModalSubmit(
    () => onCreate(name.trim(), desc.trim()),
    onClose,
    "Failed to create project",
  );

  // Auto-focus name field
  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 80);
  }, []);

  const create = () => {
    if (!name.trim()) {
      nameRef.current?.focus();
      return;
    }
    submit();
  };

  return (
    <Modal maxWidth={440} onClose={onClose}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: notion.bgSubtle,
            border: `1px solid ${notion.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          📁
        </div>
        <h2
          style={{
            margin: "0 0 3px",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-.3px",
            color: notion.text,
          }}
        >
          New project
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: notion.textMuted }}>
          Give your project a name to get started.
        </p>
      </div>

      <ModalDivider />

      {/* Fields */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div>
          <FieldLabel required>Project name</FieldLabel>
          <input
            ref={nameRef}
            className="modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="e.g. Q3 Roadmap"
          />
        </div>
        <div>
          <FieldLabel optional>Description</FieldLabel>
          <textarea
            className="modal-input"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What is this project about?"
            rows={3}
            style={{ resize: "vertical", minHeight: 72 }}
          />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <ModalFooter
        onClose={onClose}
        busy={busy}
        confirmLabel="Create project"
        busyLabel="Creating…"
        onConfirm={create}
      />
    </Modal>
  );
}

// ── Invite Modal ──────────────────────────────────────────────────────────────
export function InviteModal({
  onClose,
  onSend,
  onGenerateCode,
}: {
  onClose: () => void;
  onSend: (email: string) => void | Promise<void>;
  onGenerateCode?: () => Promise<string>;
}) {
  const [email, setEmail] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeGenerating, setCodeGenerating] = useState(false);
  const [codeError, setCodeError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { error, busy, submit } = useModalSubmit(
    () => onSend(email.trim()),
    onClose,
    "Failed to send invite",
  );

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const send = () => {
    if (!email.trim()) return;
    submit();
  };

  const handleGenerateCode = async () => {
    if (!onGenerateCode) return;
    setCodeGenerating(true);
    setCodeError("");
    setGeneratedCode(null);
    try {
      const code = await onGenerateCode();
      setGeneratedCode(code);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Failed to generate code");
    } finally {
      setCodeGenerating(false);
    }
  };

  return (
    <Modal maxWidth={420} onClose={onClose}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: notion.bgSubtle,
            border: `1px solid ${notion.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          ✉️
        </div>
        <h2
          style={{
            margin: "0 0 3px",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-.3px",
            color: notion.text,
          }}
        >
          Invite a member
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: notion.textMuted }}>
          They will be added to the project directly.
        </p>
      </div>

      <ModalDivider />

      {/* Field */}
      <div style={{ marginBottom: 20 }}>
        <FieldLabel>Email address</FieldLabel>
        <input
          ref={inputRef}
          className="modal-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="colleague@example.com"
        />

        {/* Role hint */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginTop: 10,
            padding: "8px 10px",
            background: notion.bgSubtle,
            borderRadius: 5,
            border: `1px solid ${notion.border}`,
          }}
        >
          <span style={{ fontSize: 13 }}>ℹ️</span>
          <span
            style={{ fontSize: 12.5, color: notion.textMuted, lineHeight: 1.5 }}
          >
            New members join as{" "}
            <strong style={{ color: notion.text }}>Member</strong>.
          </span>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Email actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          paddingTop: 6,
          marginBottom: 20,
        }}
      >
        <button className="modal-btn-cancel" onClick={onClose}>
          Cancel
        </button>
        <button
          className="modal-btn-confirm"
          onClick={send}
          disabled={busy || !email.trim()}
        >
          {busy && <Spinner />}
          {busy ? "Sending…" : "Send invite"}
        </button>
      </div>

      {/* ── Invite via code ── */}
      {onGenerateCode && (
        <>
          <ModalDivider />
          <div style={{ marginBottom: 20 }}>
            <FieldLabel>Or invite via join code</FieldLabel>
            {!generatedCode ? (
              <>
                <button
                  className="modal-btn-cancel"
                  onClick={handleGenerateCode}
                  disabled={codeGenerating}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    width: "100%",
                    justifyContent: "center",
                    padding: "8px 14px",
                  }}
                >
                  {codeGenerating ? (
                    <>
                      <span
                        style={{
                          display: "inline-block",
                          width: 12,
                          height: 12,
                          border: "2px solid rgba(55,53,47,0.2)",
                          borderTopColor: notion.text,
                          borderRadius: "50%",
                          animation: "spin 0.65s linear infinite",
                          flexShrink: 0,
                        }}
                      />
                      Generating…
                    </>
                  ) : (
                    <>🔗 Generate invite code</>
                  )}
                </button>
                {codeError && <ErrorBanner message={codeError} />}
              </>
            ) : (
              <div style={{ animation: "fadeSlideIn 0.2s ease" }}>
                <input
                  className="modal-input"
                  readOnly
                  value={generatedCode}
                  style={{ fontFamily: "monospace", fontSize: 13 }}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Confirm Remove Member Modal ───────────────────────────────────────────────
export function ConfirmRemoveMemberModal({
  email,
  onClose,
  onConfirm,
}: {
  email: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { error, busy, submit } = useModalSubmit(
    onConfirm,
    onClose,
    "Failed to remove member",
  );

  return (
    <Modal maxWidth={400} onClose={onClose}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "rgba(235,87,87,0.08)",
            border: "1px solid rgba(235,87,87,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          🗑
        </div>
        <h2
          style={{
            margin: "0 0 3px",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-.3px",
            color: notion.text,
          }}
        >
          Remove member
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: notion.textMuted }}>
          Do you really want to remove{" "}
          <strong style={{ color: notion.text }}>{email}</strong> from the
          project?
        </p>
      </div>

      <ModalDivider />

      {error && <ErrorBanner message={error} />}

      <ModalFooter
        onClose={onClose}
        busy={busy}
        confirmLabel="Remove"
        busyLabel="Removing…"
        onConfirm={submit}
      />
    </Modal>
  );
}

// ── Confirm Delete Project Modal ────────────────────────────────────────────
export function ConfirmDeleteProjectModal({
  projectName,
  onClose,
  onConfirm,
}: {
  projectName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { error, busy, submit } = useModalSubmit(
    onConfirm,
    onClose,
    "Failed to delete project",
  );

  return (
    <Modal maxWidth={400} onClose={onClose}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "rgba(235,87,87,0.08)",
            border: "1px solid rgba(235,87,87,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          🗑
        </div>
        <h2
          style={{
            margin: "0 0 3px",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-.3px",
            color: notion.text,
          }}
        >
          Delete &ldquo;{projectName}&rdquo;?
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: notion.textMuted }}>
          This cannot be undone. All files and data will be permanently removed.
        </p>
      </div>

      <ModalDivider />

      {error && <ErrorBanner message={error} />}

      <ModalFooter
        onClose={onClose}
        busy={busy}
        confirmLabel="Delete"
        busyLabel="Deleting…"
        onConfirm={submit}
      />
    </Modal>
  );
}

// ── Confirm Leave Project Modal ─────────────────────────────────────────────
export function ConfirmLeaveProjectModal({
  projectName,
  onClose,
  onConfirm,
}: {
  projectName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { error, busy, submit } = useModalSubmit(
    onConfirm,
    onClose,
    "Failed to leave project",
  );

  return (
    <Modal maxWidth={400} onClose={onClose}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "rgba(235,87,87,0.08)",
            border: "1px solid rgba(235,87,87,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          ⏻
        </div>
        <h2
          style={{
            margin: "0 0 3px",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-.3px",
            color: notion.text,
          }}
        >
          Leave &ldquo;{projectName}&rdquo;?
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: notion.textMuted }}>
          You will lose access to its files and messages.
        </p>
      </div>

      <ModalDivider />

      {error && <ErrorBanner message={error} />}

      <ModalFooter
        onClose={onClose}
        busy={busy}
        confirmLabel="Yes, leave"
        busyLabel="Leaving…"
        onConfirm={submit}
      />
    </Modal>
  );
}

// ── Join Project Modal ────────────────────────────────────────────────────────
export function JoinProjectModal({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const { error, busy, submit } = useModalSubmit(
    () => onJoin(code.trim()),
    onClose,
    "Failed to join project",
  );

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const join = () => {
    if (!code.trim()) return;
    submit();
  };

  return (
    <Modal maxWidth={420} onClose={onClose}>
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: notion.bgSubtle,
            border: `1px solid ${notion.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          🔗
        </div>
        <h2
          style={{
            margin: "0 0 3px",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-.3px",
            color: notion.text,
          }}
        >
          Join a project
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: notion.textMuted }}>
          Enter the invite code shared with you.
        </p>
      </div>

      <ModalDivider />

      <div style={{ marginBottom: 20 }}>
        <FieldLabel required>Invite code</FieldLabel>
        <input
          ref={inputRef}
          className="modal-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join()}
          placeholder="e.g. abc123"
        />
      </div>

      {error && <ErrorBanner message={error} />}

      <ModalFooter
        onClose={onClose}
        busy={busy}
        confirmLabel="Join project"
        busyLabel="Joining…"
        onConfirm={join}
      />
    </Modal>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────────
export function SettingsModal({
  project,
  onClose,
  onSave,
}: {
  project: Project;
  onClose: () => void;
  onSave: (patch: {
    name: string;
    desc: string;
    finished: boolean;
  }) => void | Promise<void>;
}) {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.desc);
  const [finished, setFinished] = useState(project.finished);
  const nameRef = useRef<HTMLInputElement>(null);

  const { error, busy, submit } = useModalSubmit(
    () => onSave({ name: name.trim(), desc: desc.trim(), finished }),
    onClose,
    "Failed to save settings",
  );

  useEffect(() => {
    setTimeout(() => nameRef.current?.focus(), 80);
  }, []);

  return (
    <Modal maxWidth={460} onClose={onClose}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: notion.bgSubtle,
            border: `1px solid ${notion.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            marginBottom: 12,
          }}
        >
          ⚙️
        </div>
        <h2
          style={{
            margin: "0 0 3px",
            fontSize: 17,
            fontWeight: 700,
            letterSpacing: "-.3px",
            color: notion.text,
          }}
        >
          Project settings
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: notion.textMuted }}>
          {project.name}
        </p>
      </div>

      <ModalDivider />

      {/* Fields */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div>
          <FieldLabel>Project name</FieldLabel>
          <input
            ref={nameRef}
            className="modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
          />
        </div>
        <div>
          <FieldLabel optional>Description</FieldLabel>
          <textarea
            className="modal-input"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={3}
            placeholder="What is this project about?"
            style={{ resize: "vertical", minHeight: 72 }}
          />
        </div>
      </div>

      {/* Finished toggle row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          background: finished ? "rgba(34,165,89,0.06)" : notion.bgSubtle,
          border: `1px solid ${finished ? "rgba(34,165,89,0.2)" : notion.border}`,
          borderRadius: 6,
          marginBottom: 20,
          transition: "background 250ms ease, border-color 250ms ease",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: notion.text,
              marginBottom: 2,
            }}
          >
            Mark as finished
          </div>
          <div
            style={{ fontSize: 12, color: notion.textFaint, lineHeight: 1.5 }}
          >
            Archive this project once all work is complete.
          </div>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setFinished((v) => !v)}
          title={finished ? "Mark as active" : "Mark as finished"}
          style={{
            position: "relative",
            width: 38,
            height: 22,
            borderRadius: 22,
            border: "none",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
            background: finished ? notion.toggleOn : notion.toggleOff,
            transition: "background 200ms ease",
            boxShadow: finished ? "0 0 0 3px rgba(34,165,89,0.15)" : "none",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: 3,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "transform 200ms cubic-bezier(0.16,1,0.3,1)",
              transform: `translateX(${finished ? "16px" : "0"})`,
            }}
          />
        </button>
      </div>

      {error && <ErrorBanner message={error} />}

      <ModalFooter
        onClose={onClose}
        busy={busy}
        confirmLabel="Save changes"
        busyLabel="Saving…"
        onConfirm={submit}
      />
    </Modal>
  );
}
