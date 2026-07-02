import React, { useState } from "react";
import type { Project } from "../../lib/store";
import { ERROR_STYLE, FOCUS_RING, Hov, INPUT_STYLE, LABEL_STYLE, Modal } from "./ui";

// --- Notion-style design tokens --------------------------------------
// Same palette as ProjectChatPanel.tsx. Once ./ui.tsx is shared, these
// should move to one shared theme file so every component reads from
// the same source instead of redefining hex values per-file.
const notion = {
  text: "#37352f",
  textMuted: "#787774",
  textFaint: "#9b9a97",
  border: "rgba(55, 53, 47, 0.09)",
  borderStrong: "rgba(55, 53, 47, 0.16)",
  hoverWash: "rgba(55, 53, 47, 0.08)",
  bgSubtle: "#f7f6f3",
  primary: "#191919",
  primaryHover: "#000000",
  danger: "#eb5757",
  toggleOn: "#22a559",
  toggleOff: "#d8d7d1",
};

const CANCEL_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: notion.text,
  background: "#fff",
  border: `1px solid ${notion.borderStrong}`,
  borderRadius: 4,
  padding: "6px 14px",
  cursor: "pointer",
};

const CONFIRM_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#fff",
  background: notion.primary,
  border: "none",
  borderRadius: 4,
  padding: "6px 16px",
  cursor: "pointer",
};

const FOOTER_STYLE: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
};

// Shared submit lifecycle for the modals: tracks busy/error, runs the action,
// closes on success, and surfaces the error message on failure.
function useModalSubmit(
  action: () => Promise<void> | void,
  onClose: () => void,
  fallback: string
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
      setError(e instanceof Error ? e.message : fallback);
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
    "Failed to create project"
  );

  const create = () => {
    if (!name.trim()) return;
    submit();
  };

  return (
    <Modal maxWidth={440} onClose={onClose}>
      <h2 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 700, letterSpacing: "-.2px", color: notion.text }}>
        New Project
      </h2>
      <label style={LABEL_STYLE}>
        Project Name <span style={{ color: notion.danger }}>*</span>
      </label>
      <Hov
        as="input"
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        placeholder="e.g. Q3 Roadmap"
        style={{ ...INPUT_STYLE, marginBottom: 16 }}
        focusStyle={FOCUS_RING}
      />
      <label style={LABEL_STYLE}>
        Description <span style={{ color: notion.textFaint, fontWeight: 400 }}>(optional)</span>
      </label>
      <Hov
        as="textarea"
        value={desc}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDesc(e.target.value)}
        placeholder="What is this project about?"
        rows={3}
        style={{ ...INPUT_STYLE, resize: "vertical", marginBottom: error ? 12 : 22 }}
        focusStyle={FOCUS_RING}
      />
      {error && <p style={ERROR_STYLE}>{error}</p>}
      <div style={FOOTER_STYLE}>
        <Hov as="button" onClick={onClose} style={CANCEL_STYLE} hoverStyle={{ background: notion.bgSubtle }}>
          Cancel
        </Hov>
        <Hov
          as="button"
          onClick={create}
          disabled={busy}
          style={CONFIRM_STYLE}
          hoverStyle={{ background: notion.primaryHover }}
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
}: {
  onClose: () => void;
  onSend: (email: string) => void | Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const { error, busy, submit } = useModalSubmit(
    () => onSend(email.trim()),
    onClose,
    "Failed to send invite"
  );

  const send = () => {
    if (!email.trim()) return;
    submit();
  };

  return (
    <Modal maxWidth={420} onClose={onClose}>
      <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, letterSpacing: "-.2px", color: notion.text }}>
        Invite User
      </h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: notion.textMuted }}>
        Enter the email of the person to invite.
      </p>
      <label style={LABEL_STYLE}>Email</label>
      <Hov
        as="input"
        type="email"
        value={email}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={{ ...INPUT_STYLE, marginBottom: error ? 12 : 22 }}
        focusStyle={FOCUS_RING}
      />
      {error && <p style={ERROR_STYLE}>{error}</p>}
      <div style={FOOTER_STYLE}>
        <Hov as="button" onClick={onClose} style={CANCEL_STYLE} hoverStyle={{ background: notion.bgSubtle }}>
          Cancel
        </Hov>
        <Hov
          as="button"
          onClick={send}
          disabled={busy}
          style={CONFIRM_STYLE}
          hoverStyle={{ background: notion.primaryHover }}
        >
          {busy ? "Sending…" : "Send Invite"}
        </Hov>
      </div>
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
  onSave: (patch: { name: string; desc: string; finished: boolean }) => void | Promise<void>;
}) {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.desc);
  const [finished, setFinished] = useState(project.finished);
  const { error, busy, submit } = useModalSubmit(
    () => onSave({ name, desc, finished }),
    onClose,
    "Failed to save settings"
  );

  return (
    <Modal maxWidth={440} onClose={onClose}>
      <h2 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 700, letterSpacing: "-.2px", color: notion.text }}>
        Project Settings
      </h2>
      <label style={LABEL_STYLE}>Project Name</label>
      <Hov
        as="input"
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
        style={{ ...INPUT_STYLE, marginBottom: 16 }}
        focusStyle={FOCUS_RING}
      />
      <label style={LABEL_STYLE}>Description</label>
      <Hov
        as="textarea"
        value={desc}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDesc(e.target.value)}
        rows={3}
        style={{ ...INPUT_STYLE, resize: "vertical", marginBottom: 18 }}
        focusStyle={FOCUS_RING}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          background: notion.bgSubtle,
          border: `1px solid ${notion.border}`,
          borderRadius: 4,
          marginBottom: 22,
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: notion.text }}>Mark as Finished</div>
          <div style={{ fontSize: 12, color: notion.textFaint, marginTop: 1 }}>Archive this project as complete</div>
        </div>
        <button
          onClick={() => setFinished((v) => !v)}
          style={{
            position: "relative",
            width: 36,
            height: 20,
            borderRadius: 20,
            border: "none",
            cursor: "pointer",
            padding: 0,
            transition: "background .15s",
            background: finished ? notion.toggleOn : notion.toggleOff,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: 2,
              width: 16,
              height: 16,
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
        <Hov as="button" onClick={onClose} style={CANCEL_STYLE} hoverStyle={{ background: notion.bgSubtle }}>
          Cancel
        </Hov>
        <Hov
          as="button"
          onClick={submit}
          disabled={busy}
          style={CONFIRM_STYLE}
          hoverStyle={{ background: notion.primaryHover }}
        >
          {busy ? "Saving…" : "Save"}
        </Hov>
      </div>
    </Modal>
  );
}