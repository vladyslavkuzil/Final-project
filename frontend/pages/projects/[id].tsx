import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Hov } from "../../components/infoboard/ui";
import { InviteModal, SettingsModal } from "../../components/infoboard/modals";
import { useStore, type FileItem } from "../../lib/store";
import { getToken } from "../../lib/api";

const initialOf = (email: string) => (email || "?").charAt(0).toUpperCase();

function navStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "7px 8px",
    borderRadius: 7,
    fontSize: 13.5,
    cursor: "pointer",
    textDecoration: "none",
    background: active ? "#efefec" : undefined,
    color: active ? "#37352f" : "#5c5b57",
    fontWeight: active ? 600 : 450,
  };
}

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

  const [tab, setTab] = useState<"files" | "members">("files");
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

  const onDeleteProject = async () => {
    if (!window.confirm('Delete "' + project.name + '"? This cannot be undone.')) return;
    try {
      await deleteProject(project.id);
      router.push("/projects");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to delete project");
    }
  };

  const onLeaveProject = async () => {
    if (!window.confirm('Leave "' + project.name + '"? You will lose access to its files.')) return;
    try {
      await leaveProject(project.id);
      router.push("/projects");
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to leave project");
    }
  };

  const onRename = async (f: FileItem) => {
    const next = window.prompt("Rename document", f.name);
    if (!next || next === f.name) return;
    try {
      await renameFile(project.id, f.id, next);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to rename document");
    }
  };

  const onDelete = async (f: FileItem) => {
    try {
      await deleteFile(project.id, f.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to delete document");
    }
  };

  const onDownload = async (f: FileItem) => {
    try {
      await downloadFile(project.id, f.id, f.name);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Failed to download document");
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const title = window.prompt("Document title", file.name);
    if (title === null) return;
    try {
      await uploadFile(project.id, file, title.trim() || file.name);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to upload document");
    }
  };

  const iconBtn: React.CSSProperties = {
    width: 28,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#fff",
    border: "1px solid #e8e8e4",
    borderRadius: 6,
    cursor: "pointer",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5" }}>
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 248,
            flexShrink: 0,
            background: "#fbfbfa",
            borderRight: "1px solid #ebebe8",
            display: "flex",
            flexDirection: "column",
            padding: "18px 14px",
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
              color: "#9b9a93",
              cursor: "pointer",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: 16,
              padding: "0 6px",
            }}
            hoverStyle={{ color: "#5c5b57" }}
          >
            ← All Projects
          </Hov>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 6px 16px",
              borderBottom: "1px solid #ededea",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
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
            <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-.2px", lineHeight: 1.2 }}>
              {project.name}
            </span>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Hov as="a" onClick={() => setTab("files")} style={navStyle(tab === "files")} hoverStyle={{ background: "#efefec" }}>
              <span style={{ display: "flex", width: 16, justifyContent: "center" }}>▤</span>Files
            </Hov>
            <Hov
              as="a"
              onClick={() => setTab("members")}
              style={navStyle(tab === "members")}
              hoverStyle={{ background: "#efefec" }}
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
                  padding: "7px 8px",
                  borderRadius: 7,
                  fontSize: 13.5,
                  color: "#5c5b57",
                  cursor: "pointer",
                  textDecoration: "none",
                  fontWeight: 450,
                }}
                hoverStyle={{ background: "#efefec" }}
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
                style={{
                  width: "100%",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#c0392b",
                  background: "#fff",
                  border: "1px solid #f0d4d0",
                  borderRadius: 8,
                  padding: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
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
                style={{
                  width: "100%",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#c0392b",
                  background: "#fff",
                  border: "1px solid #f0d4d0",
                  borderRadius: 8,
                  padding: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
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
                <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: "-.4px" }}>Files</h1>
                {isAdmin && (
                  <>
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
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#fff",
                        background: "#2f6fed",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                      hoverStyle={{ background: "#2560d8" }}
                    >
                      <span style={{ fontSize: 14, marginTop: -1 }}>↑</span>Upload Document
                    </Hov>
                  </>
                )}
              </div>

              {project.files.length > 0 ? (
                <div style={{ background: "#fff", border: "1px solid #ebebe8", borderRadius: 12, overflow: "hidden" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 180px 110px 96px",
                      gap: 12,
                      padding: "11px 18px",
                      borderBottom: "1px solid #ededea",
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#9b9a93",
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
                        padding: "12px 18px",
                        borderBottom: "1px solid #f3f3f1",
                        alignItems: "center",
                        fontSize: 13,
                      }}
                      hoverStyle={{ background: "#fafaf9" }}
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
                            borderRadius: 5,
                            letterSpacing: ".3px",
                          }}
                        >
                          {f.ext}
                        </span>
                        <span
                          style={{
                            fontWeight: 500,
                            color: "#37352f",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {f.name}
                        </span>
                      </div>
                      <span style={{ color: "#8b8a83" }}>{f.size}</span>
                      <span
                        style={{ color: "#8b8a83", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                      >
                        {f.by}
                      </span>
                      <span style={{ color: "#8b8a83" }}>{f.date}</span>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <Hov
                          as="button"
                          title="Download"
                          onClick={() => onDownload(f)}
                          style={{ ...iconBtn, color: "#6b6b67", fontSize: 13 }}
                          hoverStyle={{ background: "#f4f4f2", color: "#37352f" }}
                        >
                          ↓
                        </Hov>
                        {isAdmin && (
                          <>
                            <Hov
                              as="button"
                              title="Rename"
                              onClick={() => onRename(f)}
                              style={{ ...iconBtn, color: "#6b6b67", fontSize: 12 }}
                              hoverStyle={{ background: "#f4f4f2", color: "#37352f" }}
                            >
                              ✎
                            </Hov>
                            <Hov
                              as="button"
                              title="Delete"
                              onClick={() => onDelete(f)}
                              style={{ ...iconBtn, color: "#c0392b", fontSize: 12 }}
                              hoverStyle={{ background: "#fdf2f1", borderColor: "#e8b9b3" }}
                            >
                              🗑
                            </Hov>
                          </>
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
                    background: "#fff",
                    border: "1px solid #ebebe8",
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      width: 96,
                      height: 70,
                      margin: "0 auto 18px",
                      borderRadius: 10,
                      border: "1px dashed #d6d5ce",
                      background:
                        "repeating-linear-gradient(45deg,#f4f4f2,#f4f4f2 8px,#efefec 8px,#efefec 16px)",
                    }}
                  />
                  <p style={{ margin: 0, fontSize: 14, color: "#8b8a83" }}>No files yet. Upload the first one.</p>
                </div>
              )}
            </main>
          )}

          {tab === "members" && (
            <main style={{ padding: "30px 36px 90px", maxWidth: 760, width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: "-.4px" }}>Members</h1>
                {isAdmin && (
                  <Hov
                    as="button"
                    onClick={() => setModal("invite")}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#fff",
                      background: "#2f6fed",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 14px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    hoverStyle={{ background: "#2560d8" }}
                  >
                    <span style={{ fontSize: 15, marginTop: -1 }}>+</span>Invite User
                  </Hov>
                )}
              </div>
              <div style={{ background: "#fff", border: "1px solid #ebebe8", borderRadius: 12, overflow: "hidden" }}>
                {project.members.map((m, i) => (
                  <div
                    key={m.email + i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 18px",
                      borderBottom: "1px solid #f3f3f1",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "#eef0f4",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#5c5b57",
                        }}
                      >
                        {initialOf(m.email)}
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>{m.email}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: m.active ? "#22a559" : "#d0a02b",
                            display: "inline-block",
                          }}
                        />
                        <span style={{ fontSize: 12, color: "#9b9a93" }}>{m.active ? "Active" : "Pending"}</span>
                      </div>
                      {m.role === "Admin" ? (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#1a56db",
                            background: "#e8f0fe",
                            padding: "3px 9px",
                            borderRadius: 20,
                          }}
                        >
                          Admin
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: "#6b6b67",
                            background: "#f0f0ee",
                            padding: "3px 9px",
                            borderRadius: 20,
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
        </div>

        {/* Chat widget (disabled) */}
        <div
          title="Coming soon"
          style={{
            position: "fixed",
            bottom: 22,
            right: 22,
            opacity: 0.5,
            filter: "grayscale(1)",
            cursor: "not-allowed",
            zIndex: 30,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              background: "#fff",
              border: "1px solid #e3e3df",
              borderRadius: 24,
              padding: "10px 16px 10px 13px",
              boxShadow: "0 4px 14px rgba(15,15,15,.1)",
            }}
          >
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#2f6fed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 14,
              }}
            >
              💬
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#37352f" }}>Project Chat</span>
          </div>
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
