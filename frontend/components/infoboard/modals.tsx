import React, { useState } from "react";
import type { Project } from "../../lib/store";
import { FOCUS_RING, Hov, INPUT_STYLE, LABEL_STYLE, Modal } from "./ui";

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

export function NewProjectModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, desc: string) => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, desc.trim());
  };

  return (
    <Modal maxWidth={440} onClose={onClose}>
      <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 600, letterSpacing: "-.3px" }}>New Project</h2>
      <label style={LABEL_STYLE}>
        Project Name <span style={{ color: "#c0392b" }}>*</span>
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
        Description <span style={{ color: "#b3b2ac", fontWeight: 400 }}>(optional)</span>
      </label>
      <Hov
        as="textarea"
        value={desc}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDesc(e.target.value)}
        placeholder="What is this project about?"
        rows={3}
        style={{ ...INPUT_STYLE, resize: "vertical", marginBottom: 22 }}
        focusStyle={FOCUS_RING}
      />
      <div style={FOOTER_STYLE}>
        <Hov as="button" onClick={onClose} style={CANCEL_STYLE} hoverStyle={{ background: "#f4f4f2" }}>
          Cancel
        </Hov>
        <Hov as="button" onClick={create} style={CONFIRM_STYLE} hoverStyle={{ background: "#2560d8" }}>
          Create
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
  onSend: (userId: string) => void;
}) {
  const [inviteId, setInviteId] = useState("");

  const send = () => {
    const id = inviteId.trim();
    if (id) onSend(id);
    else onClose();
  };

  return (
    <Modal maxWidth={420} onClose={onClose}>
      <h2 style={{ margin: "0 0 4px", fontSize: 17, fontWeight: 600, letterSpacing: "-.3px" }}>Invite User</h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "#8b8a83" }}>
        Enter the User ID of the person to invite.
      </p>
      <label style={LABEL_STYLE}>User ID</label>
      <Hov
        as="input"
        value={inviteId}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteId(e.target.value)}
        placeholder="e.g. user_8f3a2c"
        style={{ ...INPUT_STYLE, marginBottom: 22 }}
        focusStyle={FOCUS_RING}
      />
      <div style={FOOTER_STYLE}>
        <Hov as="button" onClick={onClose} style={CANCEL_STYLE} hoverStyle={{ background: "#f4f4f2" }}>
          Cancel
        </Hov>
        <Hov as="button" onClick={send} style={CONFIRM_STYLE} hoverStyle={{ background: "#2560d8" }}>
          Send Invite
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
  onSave: (patch: { name: string; desc: string; finished: boolean }) => void;
}) {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.desc);
  const [finished, setFinished] = useState(project.finished);

  return (
    <Modal maxWidth={440} onClose={onClose}>
      <h2 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 600, letterSpacing: "-.3px" }}>Project Settings</h2>
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
          padding: "12px 14px",
          background: "#fafaf9",
          border: "1px solid #ededea",
          borderRadius: 8,
          marginBottom: 22,
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "#37352f" }}>Mark as Finished</div>
          <div style={{ fontSize: 12, color: "#9b9a93", marginTop: 1 }}>Archive this project as complete</div>
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
      <div style={FOOTER_STYLE}>
        <Hov as="button" onClick={onClose} style={CANCEL_STYLE} hoverStyle={{ background: "#f4f4f2" }}>
          Cancel
        </Hov>
        <Hov
          as="button"
          onClick={() => onSave({ name, desc, finished })}
          style={CONFIRM_STYLE}
          hoverStyle={{ background: "#2560d8" }}
        >
          Save
        </Hov>
      </div>
    </Modal>
  );
}
