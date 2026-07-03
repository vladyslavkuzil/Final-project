import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { ProjectChatPanel } from "../../components/chat/project-chat";
import { Hov, notion } from "../../components/infoboard/ui";
import { ConfirmRemoveMemberModal, InviteModal, SettingsModal } from "../../components/infoboard/modals";
import { useStore, type FileItem } from "../../lib/store";
import { api, getToken } from "../../lib/api";

// ── keyframe injection ────────────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const id = "__notion_dashboard_styles";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes fadeSlideIn {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes shimmer {
        0%   { background-position: -400px 0; }
        100% { background-position:  400px 0; }
      }

      .skeleton {
        background: linear-gradient(
          90deg,
          ${notion.bgSubtle} 25%,
          #ececea 50%,
          ${notion.bgSubtle} 75%
        );
        background-size: 400px 100%;
        animation: shimmer 1.4s ease infinite;
        border-radius: 4px;
      }

      /* Sidebar nav item */
      .nav-item {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 6px 8px;
        border-radius: 4px;
        font-size: 13.5px;
        cursor: pointer;
        text-decoration: none;
        color: ${notion.textMuted};
        font-weight: 450;
        transition: background 120ms ease, color 120ms ease;
        user-select: none;
      }
      .nav-item:hover  { background: ${notion.hoverWash}; color: ${notion.text}; }
      .nav-item.active { background: ${notion.hoverWash}; color: ${notion.text}; font-weight: 600; }

      /* File row */
      .file-row { transition: background 100ms ease; }
      .file-row:hover { background: ${notion.hoverWash} !important; }

      /* Member row */
      .member-row { transition: background 100ms ease; }
      .member-row:hover { background: ${notion.hoverWash} !important; }

      /* Icon button */
      .icon-btn {
        width: 26px; height: 26px;
        display: flex; align-items: center; justify-content: center;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        color: ${notion.textMuted};
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
      }
      .icon-btn:hover { background: ${notion.bgSubtle}; border-color: ${notion.border}; color: ${notion.text}; }
      .icon-btn.danger:hover { background: #fdf2f1; border-color: #e8b9b3; color: #c0392b; }

      /* Primary button */
      .primary-btn {
        font-size: 13px; font-weight: 500;
        color: #fff; background: #191919;
        border: none; border-radius: 4px;
        padding: 6px 13px; cursor: pointer;
        display: flex; align-items: center; gap: 6px;
        transition: background 150ms ease, transform 100ms ease, box-shadow 100ms ease;
      }
      .primary-btn:hover {
        background: #000;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      }

      /* Danger button */
      .danger-btn {
        width: 100%; font-size: 13px; font-weight: 500;
        color: ${notion.danger}; background: transparent;
        border: 1px solid ${notion.border}; border-radius: 4px;
        padding: 7px; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        transition: background 150ms ease, border-color 150ms ease;
        font-family: inherit;
      }
      .danger-btn:hover { background: #fdf2f1; border-color: #e8b9b3; }

      /* Tab content fade */
      .tab-content {
        opacity: 0;
        animation: fadeSlideIn 0.3s ease forwards;
      }

      /* Sidebar slide in */
      .sidebar-in {
        opacity: 0;
        animation: fadeIn 0.35s ease 0.05s forwards;
      }
    `;
    document.head.appendChild(s);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────
const initialOf = (email: string) => (email || "?").charAt(0).toUpperCase();

// Deterministic avatar color — same palette as ProjectChatPanel
const AVATAR_COLORS = ["#e2a03f","#9065b0","#4f8a5b","#d15c5c","#3980c1","#c17ec9"];
function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── small shared components ───────────────────────────────────────────────────
function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color,
        background: bg,
        padding: "2px 7px",
        borderRadius: 3,
        letterSpacing: ".1px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 22,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: "-.2px",
          color: notion.text,
        }}
      >
        {title}
      </h1>
      {action}
    </div>
  );
}

// ── skeleton rows for files loading state ─────────────────────────────────────
function FileSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 90px 180px 110px 96px",
            gap: 12,
            padding: "12px 18px",
            borderBottom: `1px solid ${notion.border}`,
            alignItems: "center",
            opacity: 0,
            animation: `fadeSlideIn 0.3s ease ${i * 0.06}s forwards`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="skeleton" style={{ width: 34, height: 26, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: "60%", height: 13 }} />
          </div>
          <div className="skeleton" style={{ width: 50, height: 13 }} />
          <div className="skeleton" style={{ width: "70%", height: 13 }} />
          <div className="skeleton" style={{ width: 70, height: 13 }} />
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <div className="skeleton" style={{ width: 26, height: 26, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 26, height: 26, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function ProjectDashboard() {
  const router = useRouter();
  const {
    me,
    projects,
    loaded,
    deleteProject,
    leaveProject,
    loadProjectById,
    loadProjectDocuments,
    deleteFile,
    renameFile,
    uploadFile,
    downloadFile,
    saveSettings,
    inviteByEmail,
    generateJoinCode,
    removeMember,
  } = useStore();

  const id = typeof router.query.id === "string" ? router.query.id : "";
  const rawTab =
    typeof router.query.tab === "string" ? router.query.tab : "files";
  const tab: "files" | "members" | "chat" = [
    "files",
    "members",
    "chat",
  ].includes(rawTab)
    ? (rawTab as "files" | "members" | "chat")
    : "files";
  const setTab = (t: "files" | "members" | "chat") =>
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: t } },
      undefined,
      { shallow: true },
    );
  const project = projects.find((p) => p.id === id);
  const [modal, setModal] = useState<"invite" | "settings" | null>(null);
  const [filesLoading, setFilesLoading] = useState(true);
  const [liveMembers, setLiveMembers] = useState<{ id: string; email: string; is_active: boolean; role: string }[]>([]);
  const [memberToRemove, setMemberToRemove] = useState<{ id: string; email: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMembers = (projectId: string) =>
    api
      .get<{
        users: {
          id: string;
          email: string;
          is_active: boolean;
          role: string;
        }[];
      }>(`/project/${projectId}/members`)
      .then((data) => setLiveMembers(data.users))
      .catch(() => {});

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  useEffect(() => {
    if (router.isReady && loaded && id && !project) router.replace("/projects");
  }, [router, router.isReady, loaded, id, project]);

  useEffect(() => {
    if (id && project) {
      setFilesLoading(true);
      loadProjectDocuments(id)
        .catch(() => {})
        .finally(() => setFilesLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!project]);

  // Fetch full project info (including the caller's role) from the detail endpoint.
  useEffect(() => {
    if (id) loadProjectById(id).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Load members on mount so the sidebar counter is populated immediately.
  useEffect(() => {
    if (id) fetchMembers(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Refresh live members whenever the members tab is opened.
  useEffect(() => {
    if (tab === "members" && id) {
      fetchMembers(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  if (!project) return null;

  const isAdmin = project.myRole === "Admin";
  const projInitial = initialOf(project.name.replace(/^Project\s+/i, ""));

  const runOrAlert = async (
    fn: () => Promise<void>,
    fallback: string
  ): Promise<boolean> => {
    try {
      await fn();
      return true;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : fallback);
      return false;
    }
  };

  const onDeleteProject = async () => {
    if (!window.confirm(`Delete "${project.name}"? This cannot be undone.`)) return;
    if (await runOrAlert(() => deleteProject(project.id), "Failed to delete project"))
      router.push("/projects");
  };

  const onLeaveProject = async () => {
    if (!window.confirm(`Leave "${project.name}"? You will lose access to its files.`)) return;
    if (await runOrAlert(() => leaveProject(project.id), "Failed to leave project"))
      router.push("/projects");
  };

  const onRename = async (f: FileItem) => {
    const next = window.prompt("Rename document", f.name);
    if (!next || next === f.name) return;
    await runOrAlert(() => renameFile(project.id, f.id, next), "Failed to rename");
  };

  const onDelete = (f: FileItem) =>
    runOrAlert(() => deleteFile(project.id, f.id), "Failed to delete");

  const onDownload = (f: FileItem) =>
    runOrAlert(() => downloadFile(project.id, f.id, f.name), "Failed to download");

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const title = window.prompt("Document title", file.name);
    if (title === null) return;
    await runOrAlert(
      () => uploadFile(project.id, file, title.trim() || file.name),
      "Failed to upload"
    );
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: notion.bgSubtle,
        fontFamily: notion.font,
      }}
    >
      <div style={{ display: "flex", minHeight: "100vh" }}>

        {/* ── Sidebar ── */}
        <aside
          className="sidebar-in"
          style={{
            width: 232,
            flexShrink: 0,
            background: notion.bgSidebar,
            borderRight: `1px solid ${notion.border}`,
            display: "flex",
            flexDirection: "column",
            padding: "14px 10px 16px",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
          }}
        >
          {/* Back link */}
          <a
            className="nav-item"
            onClick={() => router.push("/projects")}
            style={{ marginBottom: 10, fontSize: 12.5, color: notion.textFaint }}
          >
            <span style={{ fontSize: 11 }}>←</span>
            All projects
          </a>

          {/* Project identity block */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "8px 8px 12px",
              borderBottom: `1px solid ${notion.border}`,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                background: avatarColor(project.name),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 12,
                flexShrink: 0,
                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
              }}
            >
              {projInitial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  letterSpacing: "-.1px",
                  color: notion.text,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {project.name}
              </div>
              <div style={{ fontSize: 11.5, color: notion.textFaint, marginTop: 1 }}>
                {liveMembers.length} member{liveMembers.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {(
              [
                { key: "files",   icon: "▤", label: "Files"   },
                { key: "chat",    icon: "💬", label: "Chat"    },
                { key: "members", icon: "◍", label: "Members" },
              ] as const
            ).map(({ key, icon, label }) => (
              <a
                key={key}
                className={`nav-item${tab === key ? " active" : ""}`}
                onClick={() => setTab(key)}
              >
                <span style={{ width: 16, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                  {icon}
                </span>
                {label}
                {/* Unread dot placeholder for chat */}
                {key === "chat" && tab !== "chat" && (
                  <span
                    style={{
                      marginLeft: "auto",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: notion.accentBlue,
                      flexShrink: 0,
                      opacity: 0,
                      // Reveal this when you have unread message count logic
                    }}
                  />
                )}
              </a>
            ))}

            {isAdmin && (
              <a
                className="nav-item"
                onClick={() => setModal("settings")}
                style={{ marginTop: 4 }}
              >
                <span style={{ width: 16, display: "flex", justifyContent: "center", flexShrink: 0 }}>
                  ⚙
                </span>
                Settings
              </a>
            )}
          </nav>

          {/* Bottom danger action */}
          <div style={{ marginTop: "auto", paddingTop: 14 }}>
            {/* Subtle project meta */}
            <div
              style={{
                fontSize: 11.5,
                color: notion.textFaint,
                padding: "0 8px 12px",
                lineHeight: 1.6,
              }}
            >
              <div>Created {project.created}</div>
              <div>{project.size} used</div>
            </div>

            <button
              className="danger-btn"
              onClick={isAdmin ? onDeleteProject : onLeaveProject}
            >
              <span style={{ fontSize: 13 }}>{isAdmin ? "🗑" : "⏻"}</span>
              {isAdmin ? "Delete project" : "Leave project"}
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >

          {/* ── Files tab ── */}
          {tab === "files" && (
            <main
              className="tab-content"
              style={{ padding: "32px 40px 90px", maxWidth: 980, width: "100%" }}
            >
              <SectionHeader
                title="Files"
                action={
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.xlsx,.txt"
                      onChange={onPickFile}
                      style={{ display: "none" }}
                    />
                    <button
                      className="primary-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span style={{ fontSize: 15, marginTop: -1 }}>↑</span>
                      Upload
                    </button>
                  </>
                }
              />

              <div
                style={{
                  background: notion.bgPage,
                  border: `1px solid ${notion.border}`,
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                {/* Table header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 180px 110px 96px",
                    gap: 12,
                    padding: "9px 18px",
                    borderBottom: `1px solid ${notion.border}`,
                    fontSize: 11,
                    fontWeight: 600,
                    color: notion.textFaint,
                    textTransform: "uppercase",
                    letterSpacing: ".5px",
                    background: notion.bgSubtle,
                  }}
                >
                  <span>Name</span>
                  <span>Size</span>
                  <span>Uploaded by</span>
                  <span>Date</span>
                  <span style={{ textAlign: "right" }}>Actions</span>
                </div>

                {filesLoading ? (
                  <FileSkeleton />
                ) : project.files.length > 0 ? (
                  project.files.map((f, i) => (
                    <div
                      key={f.name + i}
                      className="file-row"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 90px 180px 110px 96px",
                        gap: 12,
                        padding: "10px 18px",
                        borderBottom: `1px solid ${notion.border}`,
                        alignItems: "center",
                        fontSize: 13,
                        opacity: 0,
                        animation: `fadeSlideIn 0.3s ease ${i * 0.04}s forwards`,
                      }}
                    >
                      {/* Name + ext badge */}
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
                        style={{
                          color: notion.textMuted,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {f.by}
                      </span>
                      <span style={{ color: notion.textMuted }}>{f.date}</span>

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button
                          className="icon-btn"
                          title="Download"
                          onClick={() => onDownload(f)}
                        >
                          ↓
                        </button>
                        <button
                          className="icon-btn"
                          title="Rename"
                          onClick={() => onRename(f)}
                        >
                          ✎
                        </button>
                        {isAdmin && (
                          <button
                            className="icon-btn danger"
                            title="Delete"
                            onClick={() => onDelete(f)}
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  // Empty state
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "64px 20px",
                      gap: 14,
                      opacity: 0,
                      animation: "fadeSlideIn 0.4s ease 0.1s forwards",
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 10,
                        background: notion.bgSubtle,
                        border: `1.5px dashed ${notion.borderStrong}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                      }}
                    >
                      📄
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 600, color: notion.text }}>
                        No files yet
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: notion.textMuted }}>
                        Upload the first document to get started.
                      </p>
                    </div>
                    <button
                      className="primary-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span style={{ fontSize: 15 }}>↑</span>
                      Upload a file
                    </button>
                  </div>
                )}
              </div>
            </main>
          )}

          {/* ── Members tab ── */}
          {tab === "members" && (
            <main
              className="tab-content"
              style={{ padding: "32px 40px 90px", maxWidth: 760, width: "100%" }}
            >
              <SectionHeader
                title="Members"
                action={
                  isAdmin ? (
                    <button
                      className="primary-btn"
                      onClick={() => setModal("invite")}
                    >
                      <span style={{ fontSize: 15, marginTop: -1 }}>+</span>
                      Invite
                    </button>
                  ) : undefined
                }
              />

              <div
                style={{
                  background: notion.bgPage,
                  border: `1px solid ${notion.border}`,
                  borderRadius: 6,
                  overflow: "hidden",
                }}
              >
                {liveMembers.map((m, i) => (
                  <div
                    key={m.id}
                    className="member-row"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "11px 18px",
                      borderBottom: `1px solid ${notion.border}`,
                      opacity: 0,
                      animation: `fadeSlideIn 0.3s ease ${i * 0.05}s forwards`,
                    }}
                  >
                    {/* Avatar + email */}
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div
                        key={m.id}
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: "50%",
                          background: avatarColor(m.email),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {initialOf(m.email)}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 500,
                            color: notion.text,
                          }}
                        >
                          {m.email.split("@")[0]}
                        </div>
                        <div style={{ fontSize: 12, color: notion.textFaint }}>
                          {m.email}
                        </div>
                      </div>
                    </div>

                    {/* Status + role */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          color: notion.textFaint,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: m.is_active ? "#4f8a5b" : "#d0a02b",
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        {m.is_active ? "Active" : "Pending"}
                      </div>

                      {m.role === "owner" ? (
                        <Badge
                          label="Admin"
                          color={notion.accentBlue}
                          bg="rgba(35,131,226,0.1)"
                        />
                      ) : (
                        <Badge
                          label="Member"
                          color={notion.textMuted}
                          bg={notion.bgSubtle}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </main>
          )}

          {/* ── Chat tab ── */}
          {tab === "chat" && (
            <div className="tab-content" style={{ flex: 1, minHeight: 0 }}>
              <ProjectChatPanel
                projectId={project.id}
                projectName={project.name}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === "invite" && (
        <InviteModal
          onClose={() => setModal(null)}
          onSend={async (email) => {
            await inviteByEmail(project.id, email);
            await fetchMembers(project.id);
          }}
          onGenerateCode={() => generateJoinCode(project.id)}
        />
      )}
      {modal === "settings" && (
        <SettingsModal
          project={project}
          onClose={() => setModal(null)}
          onSave={(patch) => saveSettings(project.id, patch)}
        />
      )}
      {memberToRemove && (
        <ConfirmRemoveMemberModal
          email={memberToRemove.email}
          onClose={() => setMemberToRemove(null)}
          onConfirm={async () => {
            await removeMember(project.id, memberToRemove.id);
            setLiveMembers((prev) =>
              prev.filter((m) => m.id !== memberToRemove.id),
            );
          }}
        />
      )}
    </div>
  );
}
