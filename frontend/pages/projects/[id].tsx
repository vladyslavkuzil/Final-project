import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { ProjectChatPanel } from "../../components/chat/project-chat";
import { notion } from "../../components/infoboard/ui";
import {
  ConfirmDeleteProjectModal,
  ConfirmLeaveProjectModal,
  ConfirmRemoveMemberModal,
  InviteModal,
  SettingsModal,
} from "../../components/infoboard/modals";
import { useStore, type FileItem } from "../../lib/store";
import { api, getToken } from "../../lib/api";

// Breakpoint below which the fixed sidebar gives way to a top bar + bottom
// tab bar, and table-style rows collapse into stacked cards.
const MOBILE_BP = 760;

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

      @media (prefers-reduced-motion: reduce) {
        .tab-content, .sidebar-in, .skeleton,
        .file-row, .member-row {
          animation: none !important;
        }
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

      /* Sidebar nav item — a reset button styled to look like the old <a> */
      .nav-item {
        display: flex;
        align-items: center;
        gap: 9px;
        width: 100%;
        padding: 6px 8px;
        border-radius: 4px;
        font-size: 13.5px;
        cursor: pointer;
        text-decoration: none;
        color: ${notion.textMuted};
        font-weight: 450;
        transition: background 120ms ease, color 120ms ease;
        user-select: none;
        background: none;
        border: none;
        text-align: left;
        font-family: inherit;
      }
      .nav-item:hover  { background: ${notion.hoverWash}; color: ${notion.text}; }
      .nav-item.active { background: ${notion.hoverWash}; color: ${notion.text}; font-weight: 600; }
      .nav-item:focus-visible {
        outline: 2px solid ${notion.accentBlue};
        outline-offset: 1px;
      }

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
        flex-shrink: 0;
      }
      .icon-btn:hover { background: ${notion.bgSubtle}; border-color: ${notion.border}; color: ${notion.text}; }
      .icon-btn.danger:hover { background: #fdf2f1; border-color: #e8b9b3; color: #c0392b; }
      .icon-btn:focus-visible,
      .primary-btn:focus-visible,
      .danger-btn:focus-visible,
      .mobile-tab:focus-visible,
      .dropdown-item:focus-visible {
        outline: 2px solid ${notion.accentBlue};
        outline-offset: 1px;
      }

      /* Primary button */
      .primary-btn {
        font-size: 13px; font-weight: 500;
        color: #fff; background: #191919;
        border: none; border-radius: 4px;
        padding: 6px 13px; cursor: pointer;
        display: flex; align-items: center; gap: 6px;
        transition: background 150ms ease, transform 100ms ease, box-shadow 100ms ease;
        white-space: nowrap;
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

      /* ── Main content padding — mobile-first, roomier on desktop ── */
      .main-pad {
        padding: 20px 16px calc(80px + env(safe-area-inset-bottom));
      }

      /* ── Responsive file rows: grid on desktop, stacked card on mobile ── */
      .file-header-row,
      .file-row {
        display: grid;
        grid-template-columns: 1fr 90px 180px 110px 96px;
      }
      .file-meta-mobile { display: none; }

      .member-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        row-gap: 8px;
      }

      /* ── Mobile top bar + bottom tab bar: hidden on desktop ── */
      .mobile-topbar, .mobile-tabbar, .mobile-tabbar-spacer {
        display: none;
      }

      @media (max-width: ${MOBILE_BP}px) {
        .app-sidebar-desktop { display: none !important; }

        .main-pad {
          padding: 16px 14px calc(72px + env(safe-area-inset-bottom));
        }

        .file-header-row { display: none; }
        .file-row {
          grid-template-columns: 1fr auto;
          row-gap: 4px;
          padding-top: 12px;
          padding-bottom: 12px;
        }
        .file-cell-size, .file-cell-by, .file-cell-date { display: none; }
        .file-meta-mobile {
          display: block;
          grid-column: 1 / -1;
          font-size: 12px;
          color: ${notion.textFaint};
          margin-top: 2px;
        }

        .member-row .member-status-label { display: none; }

        .mobile-topbar {
          display: flex;
          align-items: center;
          gap: 8px;
          height: 52px;
          flex-shrink: 0;
          padding: 0 10px;
          background: ${notion.bgSidebar};
          border-bottom: 1px solid ${notion.border};
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .mobile-topbar-title {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          flex: 1;
        }
        .mobile-topbar-avatar {
          width: 24px; height: 24px;
          border-radius: 6px;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 11px;
          flex-shrink: 0;
        }
        .mobile-topbar-name {
          font-size: 14px;
          font-weight: 600;
          color: ${notion.text};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .mobile-tabbar {
          display: flex;
          position: fixed;
          left: 0; right: 0; bottom: 0;
          height: calc(56px + env(safe-area-inset-bottom));
          padding-bottom: env(safe-area-inset-bottom);
          background: ${notion.bgSidebar};
          border-top: 1px solid ${notion.border};
          z-index: 20;
        }
        .mobile-tab {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          color: ${notion.textFaint};
          font-size: 10.5px;
          font-weight: 500;
          position: relative;
        }
        .mobile-tab.active { color: ${notion.accentBlue}; }
        .mobile-tab-icon { font-size: 18px; line-height: 1; }

        .chat-tab-wrap > section {
          height: calc(100vh - 52px - 56px - env(safe-area-inset-bottom)) !important;
          padding: 16px 14px !important;
        }
      }

      /* ── Dropdown ("more") menu ── */
      .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 25;
      }
      .dropdown-menu {
        position: absolute;
        top: calc(100% + 4px);
        right: 0;
        min-width: 220px;
        background: ${notion.bgPage};
        border: 1px solid ${notion.border};
        border-radius: 8px;
        box-shadow: 0 6px 20px rgba(15,15,15,0.12);
        padding: 6px;
        z-index: 26;
      }
      .dropdown-item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13.5px;
        font-family: inherit;
        color: ${notion.text};
        background: none;
        border: none;
        border-radius: 5px;
        padding: 8px 9px;
        cursor: pointer;
        text-align: left;
      }
      .dropdown-item:hover { background: ${notion.hoverWash}; }
      .dropdown-item.danger { color: ${notion.danger}; }
      .dropdown-item.danger:hover { background: #fdf2f1; }
      .dropdown-divider {
        height: 1px;
        background: ${notion.border};
        margin: 5px 2px;
      }
      .dropdown-meta {
        font-size: 11.5px;
        color: ${notion.textFaint};
        padding: 2px 9px 4px;
        line-height: 1.6;
      }
    `;
    document.head.appendChild(s);
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────
const initialOf = (email: string) => (email || "?").charAt(0).toUpperCase();

// Deterministic avatar color — same palette as ProjectChatPanel
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

const NAV_TABS = [
  { key: "files", icon: "▤", label: "Files" },
  { key: "chat", icon: "💬", label: "Chat" },
  { key: "members", icon: "◍", label: "Members" },
] as const;

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
        gap: 12,
        marginBottom: 22,
        flexWrap: "wrap",
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
          className="file-row"
          style={{
            gap: 12,
            padding: "12px 18px",
            borderBottom: `1px solid ${notion.border}`,
            alignItems: "center",
            opacity: 0,
            animation: `fadeSlideIn 0.3s ease ${i * 0.06}s forwards`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              className="skeleton"
              style={{ width: 34, height: 26, borderRadius: 4 }}
            />
            <div className="skeleton" style={{ width: "60%", height: 13 }} />
          </div>
          <div
            className="skeleton file-cell-size"
            style={{ width: 50, height: 13 }}
          />
          <div
            className="skeleton file-cell-by"
            style={{ width: "70%", height: 13 }}
          />
          <div
            className="skeleton file-cell-date"
            style={{ width: 70, height: 13 }}
          />
          <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
            <div
              className="skeleton"
              style={{ width: 26, height: 26, borderRadius: 4 }}
            />
            <div
              className="skeleton"
              style={{ width: 26, height: 26, borderRadius: 4 }}
            />
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
  const [liveMembers, setLiveMembers] = useState<
    { id: string; email: string; is_active: boolean; role: string }[]
  >([]);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
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
        .then((members) => setLiveMembers(members))
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

  // Refresh live members whenever the members tab is opened.
  useEffect(() => {
    if (tab === "members" && id) {
      fetchMembers(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id]);

  // Close the mobile "more" menu whenever the tab changes.
  useEffect(() => {
    setMoreMenuOpen(false);
  }, [tab]);

  if (!project) return null;

  const isAdmin = project.myRole === "Admin";
  const projInitial = initialOf(project.name.replace(/^Project\s+/i, ""));

  const runOrAlert = async (
    fn: () => Promise<void>,
    fallback: string,
  ): Promise<boolean> => {
    try {
      await fn();
      return true;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : fallback);
      return false;
    }
  };

  const onDeleteProject = () => setShowDeleteModal(true);

  const onLeaveProject = () => setShowLeaveModal(true);

  const onRename = async (f: FileItem) => {
    const next = window.prompt("Rename document", f.name);
    if (!next || next === f.name) return;
    await runOrAlert(
      () => renameFile(project.id, f.id, next),
      "Failed to rename",
    );
  };

  const onDelete = (f: FileItem) =>
    runOrAlert(() => deleteFile(project.id, f.id), "Failed to delete");

  const onDownload = (f: FileItem) =>
    runOrAlert(
      () => downloadFile(project.id, f.id, f.name),
      "Failed to download",
    );

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const title = window.prompt("Document title", file.name);
    if (title === null) return;
    await runOrAlert(
      () => uploadFile(project.id, file, title.trim() || file.name),
      "Failed to upload",
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
        {/* ── Sidebar (desktop only) ── */}
        <aside
          className="sidebar-in app-sidebar-desktop"
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
          <button
            type="button"
            className="nav-item"
            onClick={() => router.push("/projects")}
            style={{
              marginBottom: 10,
              fontSize: 12.5,
              color: notion.textFaint,
            }}
          >
            <span style={{ fontSize: 11 }}>←</span>
            All projects
          </button>

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
              <div
                style={{
                  fontSize: 11.5,
                  color: notion.textFaint,
                  marginTop: 1,
                }}
              >
                {liveMembers.length} member{liveMembers.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {NAV_TABS.map(({ key, icon, label }) => (
              <button
                key={key}
                type="button"
                className={`nav-item${tab === key ? " active" : ""}`}
                onClick={() => setTab(key)}
                aria-current={tab === key ? "page" : undefined}
              >
                <span
                  style={{
                    width: 16,
                    display: "flex",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
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
              </button>
            ))}

            {isAdmin && (
              <button
                type="button"
                className="nav-item"
                onClick={() => setModal("settings")}
                style={{ marginTop: 4 }}
              >
                <span
                  style={{
                    width: 16,
                    display: "flex",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  ⚙
                </span>
                Settings
              </button>
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

            {isAdmin ? (
              <button
                type="button"
                className="danger-btn"
                onClick={onDeleteProject}
              >
                <span style={{ fontSize: 13 }}>🗑</span>
                Delete project
              </button>
            ) : (
              <button
                type="button"
                className="danger-btn"
                onClick={onLeaveProject}
              >
                <span style={{ fontSize: 13 }}>⏻</span>
                Leave project
              </button>
            )}
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
          {/* ── Mobile top bar ── */}
          <header className="mobile-topbar">
            <button
              type="button"
              className="icon-btn"
              aria-label="Back to all projects"
              onClick={() => router.push("/projects")}
            >
              ‹
            </button>
            <div className="mobile-topbar-title">
              <div
                className="mobile-topbar-avatar"
                style={{ background: avatarColor(project.name) }}
              >
                {projInitial}
              </div>
              <span className="mobile-topbar-name">{project.name}</span>
            </div>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="icon-btn"
                aria-label="Project options"
                aria-haspopup="menu"
                aria-expanded={moreMenuOpen}
                onClick={() => setMoreMenuOpen((o) => !o)}
              >
                ⋯
              </button>
              {moreMenuOpen && (
                <>
                  <div
                    className="menu-backdrop"
                    onClick={() => setMoreMenuOpen(false)}
                  />
                  <div className="dropdown-menu" role="menu">
                    {isAdmin && (
                      <button
                        type="button"
                        role="menuitem"
                        className="dropdown-item"
                        onClick={() => {
                          setModal("settings");
                          setMoreMenuOpen(false);
                        }}
                      >
                        ⚙ Settings
                      </button>
                    )}
                    <div className="dropdown-meta">
                      {liveMembers.length} member
                      {liveMembers.length !== 1 ? "s" : ""} · Created{" "}
                      {project.created} · {project.size} used
                    </div>
                    <div className="dropdown-divider" />
                    {isAdmin ? (
                      <button
                        type="button"
                        role="menuitem"
                        className="dropdown-item danger"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onDeleteProject();
                        }}
                      >
                        🗑 Delete project
                      </button>
                    ) : (
                      <button
                        type="button"
                        role="menuitem"
                        className="dropdown-item danger"
                        onClick={() => {
                          setMoreMenuOpen(false);
                          onLeaveProject();
                        }}
                      >
                        ⏻ Leave project
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </header>

          {/* ── Files tab ── */}
          {tab === "files" && (
            <main
              className="tab-content main-pad"
              style={{
                maxWidth: 980,
                width: "100%",
              }}
            >
              <SectionHeader
                title="Files"
                action={
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.docx,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff"
                      onChange={onPickFile}
                      style={{ display: "none" }}
                    />
                    <button
                      type="button"
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
                {/* Table header (hidden on mobile) */}
                <div
                  className="file-header-row"
                  style={{
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
                        gap: 12,
                        padding: "10px 18px",
                        borderBottom: `1px solid ${notion.border}`,
                        alignItems: "center",
                        fontSize: 13,
                        opacity: 0,
                        animation: `fadeSlideIn 0.3s ease ${i * 0.04}s forwards`,
                      }}
                    >
                      {/* Name + ext badge (+ mobile meta line) */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          minWidth: 0,
                          flexWrap: "wrap",
                        }}
                      >
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
                            minWidth: 0,
                          }}
                        >
                          {f.name}
                        </span>
                        <div className="file-meta-mobile">
                          {f.size} · {f.by} · {f.date}
                        </div>
                      </div>

                      <span
                        className="file-cell-size"
                        style={{ color: notion.textMuted }}
                      >
                        {f.size}
                      </span>
                      <span
                        className="file-cell-by"
                        style={{
                          color: notion.textMuted,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {f.by}
                      </span>
                      <span
                        className="file-cell-date"
                        style={{ color: notion.textMuted }}
                      >
                        {f.date}
                      </span>

                      {/* Actions */}
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          className="icon-btn"
                          title="Download"
                          aria-label={`Download ${f.name}`}
                          onClick={() => onDownload(f)}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title="Rename"
                          aria-label={`Rename ${f.name}`}
                          onClick={() => onRename(f)}
                        >
                          ✎
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            className="icon-btn danger"
                            title="Delete"
                            aria-label={`Delete ${f.name}`}
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
                      <p
                        style={{
                          margin: "0 0 4px",
                          fontSize: 14,
                          fontWeight: 600,
                          color: notion.text,
                        }}
                      >
                        No files yet
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: notion.textMuted,
                        }}
                      >
                        Upload the first document to get started.
                      </p>
                    </div>
                    <button
                      type="button"
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
              className="tab-content main-pad"
              style={{
                maxWidth: 980,
                width: "100%",
              }}
            >
              <SectionHeader
                title="Members"
                action={
                  isAdmin ? (
                    <button
                      type="button"
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
                      padding: "11px 18px",
                      borderBottom: `1px solid ${notion.border}`,
                      opacity: 0,
                      animation: `fadeSlideIn 0.3s ease ${i * 0.05}s forwards`,
                    }}
                  >
                    {/* Avatar + email */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 11,
                        minWidth: 0,
                      }}
                    >
                      <div
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
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13.5,
                            fontWeight: 500,
                            color: notion.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {m.email.split("@")[0]}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: notion.textFaint,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: 220,
                          }}
                        >
                          {m.email}
                        </div>
                      </div>
                    </div>

                    {/* Status + role */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        className="member-status-label"
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

                      {isAdmin && m.role !== "owner" && m.email !== me && (
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Remove member"
                          aria-label={`Remove ${m.email}`}
                          onClick={() =>
                            setMemberToRemove({ id: m.id, email: m.email })
                          }
                        >
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </main>
          )}

          {/* ── Chat tab ── always mounted to preserve WS connection and avoid re-fetching history */}
          <div
            className="tab-content chat-tab-wrap"
            style={{
              flex: 1,
              minHeight: 0,
              display: tab === "chat" ? undefined : "none",
            }}
          >
            <ProjectChatPanel
              projectId={project.id}
              projectName={project.name}
            />
          </div>

          {/* ── Mobile bottom tab bar ── */}
          <nav className="mobile-tabbar" aria-label="Project sections">
            {NAV_TABS.map(({ key, icon, label }) => (
              <button
                key={key}
                type="button"
                className={`mobile-tab${tab === key ? " active" : ""}`}
                onClick={() => setTab(key)}
                aria-current={tab === key ? "page" : undefined}
              >
                <span className="mobile-tab-icon">{icon}</span>
                <span className="mobile-tab-label">{label}</span>
              </button>
            ))}
          </nav>
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
      {showDeleteModal && (
        <ConfirmDeleteProjectModal
          projectName={project.name}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={async () => {
            await deleteProject(project.id);
            router.push("/projects");
          }}
        />
      )}
      {showLeaveModal && (
        <ConfirmLeaveProjectModal
          projectName={project.name}
          onClose={() => setShowLeaveModal(false)}
          onConfirm={async () => {
            await leaveProject(project.id);
            router.push("/projects");
          }}
        />
      )}
    </div>
  );
}
