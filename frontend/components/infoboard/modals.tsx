import React, { useState } from "react";
import type { Project } from "../../lib/store";
import {
  ERROR_STYLE,
  FOCUS_RING,
  Hov,
  INPUT_STYLE,
  LABEL_STYLE,
  Modal,
} from "./ui";

const DANGER_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#fff",
  background: "#d93025",
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  cursor: "pointer",
};

const CANCEL_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#5c5b57",
  background: "#fff",
  border: "1px solid #e3e3df",
  borderRadius: 8,
  padding: "8px 16px",
  cursor: "pointer",
};

const CONFIRM_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#fff",
  background: "#2f6fed",
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  cursor: "pointer",
};

const FOOTER_STYLE: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

// Shared submit lifecycle for the modals: tracks busy/error, runs the action,
// closes on success, and surfaces the error message on failure.
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

export function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, desc: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const { error, busy, submit } = useModalSubmit(
    () => onCreate(name.trim(), desc.trim()),
    onClose,
    "Failed to create project",
  );

  const create = () => {
    if (!name.trim()) return;
    submit();
  };

  return (
    <Modal maxWidth={440} onClose={onClose}>
      <h2
        style={{
          margin: "0 0 18px",
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-.3px",
        }}
      >
        New Project
      </h2>
      <label style={LABEL_STYLE}>
        Project Name <span style={{ color: "#c0392b" }}>*</span>
      </label>
      <Hov
        as="input"
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setName(e.target.value)
        }
        placeholder="e.g. Q3 Roadmap"
        style={{ ...INPUT_STYLE, marginBottom: 16 }}
        focusStyle={FOCUS_RING}
      />
      <label style={LABEL_STYLE}>
        Description{" "}
        <span style={{ color: "#b3b2ac", fontWeight: 400 }}>(optional)</span>
      </label>
      <Hov
        as="textarea"
        value={desc}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          setDesc(e.target.value)
        }
        placeholder="What is this project about?"
        rows={3}
        style={{
          ...INPUT_STYLE,
          resize: "vertical",
          marginBottom: error ? 12 : 22,
        }}
        focusStyle={FOCUS_RING}
      />
      {error && <p style={ERROR_STYLE}>{error}</p>}
      <div style={FOOTER_STYLE}>
        <Hov
          as="button"
          onClick={onClose}
          style={CANCEL_STYLE}
          hoverStyle={{ background: "#f4f4f2" }}
        >
          Cancel
        </Hov>
        <Hov
          as="button"
          onClick={create}
          disabled={busy}
          style={CONFIRM_STYLE}
          hoverStyle={{ background: "#2560d8" }}
        >
          {busy ? "Creating…" : "Create"}
        </Hov>
      </div>
    </Modal>
  );
}

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
  const [copied, setCopied] = useState(false);
  const { error, busy, submit } = useModalSubmit(
    () => onSend(email.trim()),
    onClose,
    "Failed to send invite",
  );

  const send = () => {
    if (!email.trim()) return;
    submit();
  };

  const handleGenerateCode = async () => {
    if (!onGenerateCode) return;
    setCodeGenerating(true);
    setCodeError("");
    setGeneratedCode(null);
    setCopied(false);
    try {
      const code = await onGenerateCode();
      setGeneratedCode(code);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Failed to generate code");
    } finally {
      setCodeGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Modal maxWidth={420} onClose={onClose}>
      <h2
        style={{
          margin: "0 0 4px",
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-.3px",
        }}
      >
        Invite User
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "#8b8a83" }}>
        Enter the email of the person to invite.
      </p>
      <label style={LABEL_STYLE}>Email</label>
      <Hov
        as="input"
        type="email"
        value={email}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setEmail(e.target.value)
        }
        placeholder="you@example.com"
        style={{ ...INPUT_STYLE, marginBottom: error ? 12 : 22 }}
        focusStyle={FOCUS_RING}
      />
      {error && <p style={ERROR_STYLE}>{error}</p>}
      <div style={FOOTER_STYLE}>
        <Hov
          as="button"
          onClick={onClose}
          style={CANCEL_STYLE}
          hoverStyle={{ background: "#f4f4f2" }}
        >
          Cancel
        </Hov>
        <Hov
          as="button"
          onClick={send}
          disabled={busy}
          style={CONFIRM_STYLE}
          hoverStyle={{ background: "#2560d8" }}
        >
          {busy ? "Sending…" : "Send Invite"}
        </Hov>
      </div>

      {onGenerateCode && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "20px 0 16px",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#e3e3df" }} />
            <span style={{ fontSize: 12, color: "#b3b2ac" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "#e3e3df" }} />
          </div>
          <Hov
            as="button"
            onClick={handleGenerateCode}
            disabled={codeGenerating}
            style={{
              ...CANCEL_STYLE,
              width: "100%",
              textAlign: "center" as const,
              marginBottom: generatedCode || codeError ? 12 : 0,
            }}
            hoverStyle={{ background: "#f4f4f2" }}
          >
            {codeGenerating ? "Generating…" : "Generate Invite Code"}
          </Hov>
          {codeError && <p style={ERROR_STYLE}>{codeError}</p>}
          {generatedCode && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#f7f6f3",
                border: "1px solid #e3e3df",
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <code
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontFamily: "monospace",
                  color: "#37352f",
                  wordBreak: "break-all" as const,
                  userSelect: "all" as const,
                }}
              >
                {generatedCode}
              </code>
              <Hov
                as="button"
                onClick={handleCopy}
                style={{
                  ...CANCEL_STYLE,
                  padding: "6px 12px",
                  flexShrink: 0,
                  fontSize: 12,
                }}
                hoverStyle={{ background: "#efefec" }}
              >
                {copied ? "Copied!" : "Copy"}
              </Hov>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

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
  const { error, busy, submit } = useModalSubmit(
    () => onSave({ name, desc, finished }),
    onClose,
    "Failed to save settings",
  );

  return (
    <Modal maxWidth={440} onClose={onClose}>
      <h2
        style={{
          margin: "0 0 18px",
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-.3px",
        }}
      >
        Project Settings
      </h2>
      <label style={LABEL_STYLE}>Project Name</label>
      <Hov
        as="input"
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setName(e.target.value)
        }
        style={{ ...INPUT_STYLE, marginBottom: 16 }}
        focusStyle={FOCUS_RING}
      />
      <label style={LABEL_STYLE}>Description</label>
      <Hov
        as="textarea"
        value={desc}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          setDesc(e.target.value)
        }
        rows={3}
        style={{ ...INPUT_STYLE, resize: "vertical", marginBottom: 18 }}
        focusStyle={FOCUS_RING}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 14px",
          background: "#fafaf9",
          border: "1px solid #ededea",
          borderRadius: 8,
          marginBottom: 22,
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "#37352f" }}>
            Mark as Finished
          </div>
          <div style={{ fontSize: 12, color: "#9b9a93", marginTop: 1 }}>
            Archive this project as complete
          </div>
        </div>
        <button
          onClick={() => setFinished((v) => !v)}
          style={{
            position: "relative",
            width: 38,
            height: 22,
            borderRadius: 20,
            border: "none",
            cursor: "pointer",
            padding: 0,
            transition: "background .15s",
            background: finished ? "#22a559" : "#d8d7d1",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: 2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 2px rgba(0,0,0,.2)",
              transition: "transform .15s",
              transform: `translateX(${finished ? "16px" : "0"})`,
            }}
          />
        </button>
      </div>
      {error && <p style={ERROR_STYLE}>{error}</p>}
      <div style={FOOTER_STYLE}>
        <Hov
          as="button"
          onClick={onClose}
          style={CANCEL_STYLE}
          hoverStyle={{ background: "#f4f4f2" }}
        >
          Cancel
        </Hov>
        <Hov
          as="button"
          onClick={submit}
          disabled={busy}
          style={CONFIRM_STYLE}
          hoverStyle={{ background: "#2560d8" }}
        >
          {busy ? "Saving…" : "Save"}
        </Hov>
      </div>
    </Modal>
  );
}

export function JoinProjectModal({
  onClose,
  onJoin,
}: {
  onClose: () => void;
  onJoin: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const { error, busy, submit } = useModalSubmit(
    () => onJoin(code.trim()),
    onClose,
    "Failed to join project",
  );

  const join = () => {
    if (!code.trim()) return;
    submit();
  };

  return (
    <Modal maxWidth={420} onClose={onClose}>
      <h2
        style={{
          margin: "0 0 4px",
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-.3px",
        }}
      >
        Join Project
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "#8b8a83" }}>
        Enter the invite code shared with you.
      </p>
      <label style={LABEL_STYLE}>Invite Code</label>
      <Hov
        as="input"
        value={code}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setCode(e.target.value)
        }
        placeholder="Please enter the invite code"
        style={{
          ...INPUT_STYLE,
          marginBottom: error ? 12 : 22,
          fontFamily: "monospace",
        }}
        focusStyle={FOCUS_RING}
      />
      {error && <p style={ERROR_STYLE}>{error}</p>}
      <div style={FOOTER_STYLE}>
        <Hov
          as="button"
          onClick={onClose}
          style={CANCEL_STYLE}
          hoverStyle={{ background: "#f4f4f2" }}
        >
          Cancel
        </Hov>
        <Hov
          as="button"
          onClick={join}
          disabled={busy}
          style={CONFIRM_STYLE}
          hoverStyle={{ background: "#2560d8" }}
        >
          {busy ? "Joining…" : "Join"}
        </Hov>
      </div>
    </Modal>
  );
}

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
      <h2
        style={{
          margin: "0 0 10px",
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-.3px",
        }}
      >
        Remove Member
      </h2>
      <p
        style={{
          margin: "0 0 22px",
          fontSize: 13.5,
          color: "#5c5b57",
          lineHeight: 1.5,
        }}
      >
        Are you sure you want to remove{" "}
        <strong style={{ color: "#37352f" }}>{email}</strong> from this project?
      </p>
      {error && <p style={ERROR_STYLE}>{error}</p>}
      <div style={FOOTER_STYLE}>
        <Hov
          as="button"
          onClick={onClose}
          style={CANCEL_STYLE}
          hoverStyle={{ background: "#f4f4f2" }}
        >
          Cancel
        </Hov>
        <Hov
          as="button"
          onClick={submit}
          disabled={busy}
          style={DANGER_STYLE}
          hoverStyle={{ background: "#b92a1f" }}
        >
          {busy ? "Removing…" : "Yes, delete"}
        </Hov>
      </div>
    </Modal>
  );
}
