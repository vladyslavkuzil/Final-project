import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { ProjectChatPanel } from "../../components/chat/project-chat";
import { Hov, notion } from "../../components/infoboard/ui";
import { InviteModal, SettingsModal } from "../../components/infoboard/modals";
import { useStore, type FileItem } from "../../lib/store";
import { getToken } from "../../lib/api";

const initialOf = (email: string) => (email || "?").charAt(0).toUpperCase();

function navStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "6px 8px",
    borderRadius: 4,
    fontSize: 13.5,
    cursor: "pointer",
    textDecoration: "none",
    background: active ? notion.hoverWash : undefined,
    color: active ? notion.text : notion.textMuted,
    fontWeight: active ? 600 : 450,
  };
}

const dangerBtn: React.CSSProperties = {
  width: "100%",
  fontSize: 13,
  fontWeight: 500,
  color: notion.danger,
  background: "#fff",
  border: `1px solid ${notion.border}`,
  borderRadius: 4,
  padding: 7,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const primaryBtn: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#fff",
  background: notion.primary,
  border: "none",
  borderRadius: 4,
  padding: "6px 14px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const iconBtn: React.CSSProperties = {
  width: 26,
  height: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#fff",
  border: `1px solid ${notion.border}`,
  borderRadius: 4,
  cursor: "pointer",
};

export default function ProjectDashboard() {
  const router = useRouter();
  const {
    projects,
    loaded,
    deleteProject,
    leaveProject,
    loadProjectDocuments,
    deleteFile,
    renameFile,
    uploadFile,
    downloadFile,
    saveSettings,
    inviteByEmail,
  } = useStore();

  const id = typeof router.query.id === "string" ? router.query.id : "";
  const project = projects.find((p) => p.id === id);

  const [tab, setTab] = useState<"files" | "members" | "chat">("files");
  const [modal, setModal] = useState<"invite" | "settings" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  useEffect(() => {
    if (router.isReady && loaded && id && !project) router.replace("/projects");
  }, [router, router.isReady, loaded, id, project]);

  // Documents aren't part of the projects list payload — fetch them on view.
  useEffect(() => {
    if (id && project) loadProjectDocuments(id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!project]);

  if (!project) return null;

  const isAdmin = project.myRole === "Admin";
  const projInitial = initialOf(project.name.replace(/^Project\s+/i, ""));

  // Run an async action, surfacing any failure as an alert. Returns whether it
  // succeeded so callers can navigate only on success.
  const runOrAlert = async (fn: () => Promise<void>, fallback: string): Promise<boolean> => {
    try {
      await fn();
      return true;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : fallback);
      return false;
    }
  };

  const onDeleteProject = async () => {
    if (!window.confirm('Delete "' + project.name + '"? This cannot be undone.')) return;
    if (await runOrAlert(() => deleteProject(project.id), "Failed to delete project")) {
      router.push("/projects");
    }
  };

  const onLeaveProject = async () => {
    if (!window.confirm('Leave "' + project.name + '"? You will lose access to its files.')) return;
    if (await runOrAlert(() => leaveProject(project.id), "Failed to leave project")) {
      router.push("/projects");
    }
  };

  const onRename = async (f: FileItem) => {
    const next = window.prompt("Rename document", f.name);
    if (!next || next === f.name) return;
    await runOrAlert(() => renameFile(project.id, f.id, next), "Failed to rename document");
  };

  const onDelete = (f: FileItem) =>
    runOrAlert(() => deleteFile(project.id, f.id), "Failed to delete document");

  const onDownload = (f: FileItem) =>
    runOrAlert(() => downloadFile(project.id, f.id, f.name), "Failed to download document");

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const title = window.prompt("Document title", file.name);
    if (title === null) return;
    await runOrAlert(
      () => uploadFile(project.id, file, title.trim() || file.name),
      "Failed to upload document"
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: notion.bgSidebar, fontFamily: notion.font }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            background: notion.bgSidebar,
            borderRight: `1px solid ${notion.border}`,
            display: "flex",
            flexDirection: "column",
            padding: "16px 12px",
            position: "sticky",
            top: 0,
            height: "100vh",
          }}
        >
          <Hov
            as="a"
            onClick={() => router.push("/projects")}
            style={{
              fontSize: 12.5,
              color: notion.textFaint,
              cursor: "pointer",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 14,
              padding: "4px 6px",
              borderRadius: 4,
            }}
            hoverStyle={{ background: notion.hoverWash, color: notion.text }}
          >
            ← All Projects
          </Hov>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 6px 14px",
              borderBottom: `1px solid ${notion.border}`,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: 5,
                background: "#2f6fed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {projInitial}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-.1px", lineHeight: 1.2, color: notion.text }}>
              {project.name}
            </span>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Hov as="a" onClick={() => setTab("files")} style={navStyle(tab === "files")} hoverStyle={{ background: notion.hoverWash }}>
              <span style={{ display: "flex", width: 16, justifyContent: "center" }}>▤</span>Files
            </Hov>
            <Hov as="a" onClick={() => setTab("chat")} style={navStyle(tab === "chat")} hoverStyle={{ background: notion.hoverWash }}>
              <span style={{ display: "flex", width: 16, justifyContent: "center" }}>💬</span>Chat
            </Hov>
            <Hov
              as="a"
              onClick={() => setTab("members")}
              style={navStyle(tab === "members")}
              hoverStyle={{ background: notion.hoverWash }}
            >
              <span style={{ display: "flex", width: 16, justifyContent: "center" }}>◍</span>Members
            </Hov>
            {isAdmin && (
              <Hov
                as="a"
                onClick={() => setModal("settings")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "6px 8px",
                  borderRadius: 4,
                  fontSize: 13.5,
                  color: notion.textMuted,
                  cursor: "pointer",
                  textDecoration: "none",
                  fontWeight: 450,
                }}
                hoverStyle={{ background: notion.hoverWash }}
              >
                <span style={{ display: "flex", width: 16, justifyContent: "center" }}>⚙</span>Project Settings
              </Hov>
            )}
          </nav>

          {isAdmin && (
            <div style={{ marginTop: "auto", paddingTop: 14 }}>
              <Hov
                as="button"
                onClick={onDeleteProject}
                style={dangerBtn}
                hoverStyle={{ background: "#fdf2f1", borderColor: "#e8b9b3" }}
              >
                <span style={{ fontSize: 13 }}>🗑</span>Delete Project
              </Hov>
            </div>
          )}
          {!isAdmin && (
            <div style={{ marginTop: "auto", paddingTop: 14 }}>
              <Hov
                as="button"
                onClick={onLeaveProject}
                style={dangerBtn}
                hoverStyle={{ background: "#fdf2f1", borderColor: "#e8b9b3" }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>⏻</span>Leave Project
              </Hov>
            </div>
          )}
        </aside>

        {/* Main */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {tab === "files" && (
            <main style={{ padding: "30px 36px 90px", maxWidth: 980, width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-.2px", color: notion.text }}>
                  Files
                </h1>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.xlsx,.txt"
                  onChange={onPickFile}
                  style={{ display: "none" }}
                />
                <Hov
                  as="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={primaryBtn}
                  hoverStyle={{ background: notion.primaryHover }}
                >
                  <span style={{ fontSize: 14, marginTop: -1 }}>↑</span>Upload Document
                </Hov>
              </div>

              {project.files.length > 0 ? (
                <div style={{ background: notion.bgPage, border: `1px solid ${notion.border}`, borderRadius: 6, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 180px 110px 96px",
                      gap: 12,
                      padding: "9px 18px",
                      borderBottom: `1px solid ${notion.border}`,
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: notion.textFaint,
                      textTransform: "uppercase",
                      letterSpacing: ".4px",
                    }}
                  >
                    <span>Name</span>
                    <span>Size</span>
                    <span>Uploaded By</span>
                    <span>Date</span>
                    <span style={{ textAlign: "right" }}>Actions</span>
                  </div>
                  {project.files.map((f, i) => (
                    <Hov
                      key={f.name + i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 90px 180px 110px 96px",
                        gap: 12,
                        padding: "10px 18px",
                        borderBottom: `1px solid ${notion.border}`,
                        alignItems: "center",
                        fontSize: 13,
                      }}
                      hoverStyle={{ background: notion.hoverWash }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        <span
                          style={{
                            flexShrink: 0,
                            width: 34,
                            textAlign: "center",
                            font: "600 9.5px ui-monospace,Menlo,monospace",
                            color: "#fff",
                            background: f.color,
                            padding: "4px 0",
                            borderRadius: 4,
                            letterSpacing: ".3px",
                          }}
                        >
                          {f.ext}
                        </span>
                        <span
                          style={{
                            fontWeight: 500,
                            color: notion.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {f.name}
                        </span>
                      </div>
                      <span style={{ color: notion.textMuted }}>{f.size}</span>
                      <span
                        style={{ color: notion.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {f.by}
                      </span>
                      <span style={{ color: notion.textMuted }}>{f.date}</span>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <Hov
                          as="button"
                          title="Download"
                          onClick={() => onDownload(f)}
                          style={{ ...iconBtn, color: notion.textMuted, fontSize: 13 }}
                          hoverStyle={{ background: notion.bgSubtle, color: notion.text }}
                        >
                          ↓
                        </Hov>
                        <Hov
                          as="button"
                          title="Rename"
                          onClick={() => onRename(f)}
                          style={{ ...iconBtn, color: notion.textMuted, fontSize: 12 }}
                          hoverStyle={{ background: notion.bgSubtle, color: notion.text }}
                        >
                          ✎
                        </Hov>
                        {isAdmin && (
                          <Hov
                            as="button"
                            title="Delete"
                            onClick={() => onDelete(f)}
                            style={{ ...iconBtn, color: notion.danger, fontSize: 12 }}
                            hoverStyle={{ background: "#fdf2f1", borderColor: "#e8b9b3" }}
                          >
                            🗑
                          </Hov>
                        )}
                      </div>
                    </Hov>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    padding: "64px 20px",
                    background: notion.bgPage,
                    border: `1px solid ${notion.border}`,
                    borderRadius: 6,
                  }}
                >
                  <div
                    style={{
                      width: 96,
                      height: 70,
                      margin: "0 auto 18px",
                      borderRadius: 6,
                      border: `1px dashed ${notion.borderStrong}`,
                      background:
                        "repeating-linear-gradient(45deg,#f4f4f2,#f4f4f2 8px,#efefec 8px,#efefec 16px)",
                    }}
                  />
                  <p style={{ margin: 0, fontSize: 14, color: notion.textMuted }}>No files yet. Upload the first one.</p>
                </div>
              )}
            </main>
          )}

          {tab === "members" && (
            <main style={{ padding: "30px 36px 90px", maxWidth: 760, width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-.2px", color: notion.text }}>
                  Members
                </h1>
                {isAdmin && (
                  <Hov
                    as="button"
                    onClick={() => setModal("invite")}
                    style={primaryBtn}
                    hoverStyle={{ background: notion.primaryHover }}
                  >
                    <span style={{ fontSize: 15, marginTop: -1 }}>+</span>Invite User
                  </Hov>
                )}
              </div>
              <div style={{ background: notion.bgPage, border: `1px solid ${notion.border}`, borderRadius: 6, overflow: "hidden" }}>
                {project.members.map((m, i) => (
                  <div
                    key={m.email + i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 18px",
                      borderBottom: `1px solid ${notion.border}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: notion.bgSubtle,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 600,
                          color: notion.textMuted,
                        }}
                      >
                        {initialOf(m.email)}
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: notion.text }}>{m.email}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: m.active ? "#4f8a5b" : "#d0a02b",
                            display: "inline-block",
                          }}
                        />
                        <span style={{ fontSize: 12, color: notion.textFaint }}>{m.active ? "Active" : "Pending"}</span>
                      </div>
                      {m.role === "Admin" ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: notion.accentBlue,
                            background: notion.bgSubtle,
                            padding: "3px 9px",
                            borderRadius: 4,
                          }}
                        >
                          Admin
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: notion.textMuted,
                            background: notion.bgSubtle,
                            padding: "3px 9px",
                            borderRadius: 4,
                          }}
                        >
                          Member
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </main>
          )}

          {tab === "chat" && <ProjectChatPanel projectId={project.id} projectName={project.name} />}
        </div>
      </div>

      {modal === "invite" && (
        <InviteModal
          onClose={() => setModal(null)}
          onSend={(email) => inviteByEmail(project.id, email)}
        />
      )}
      {modal === "settings" && (
        <SettingsModal
          project={project}
          onClose={() => setModal(null)}
          onSave={(patch) => saveSettings(project.id, patch)}
        />
      )}
    </div>
  );
}