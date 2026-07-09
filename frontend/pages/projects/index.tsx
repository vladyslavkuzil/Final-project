import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Hov, Logo } from "../../components/infoboard/ui";
import {
  JoinProjectModal,
  NewProjectModal,
} from "../../components/infoboard/modals";
import { useStore } from "../../lib/store";
import { clearAuth, getToken } from "../../lib/api";

const notion = {
  text: "#37352f",
  textMuted: "#787774",
  textFaint: "#9b9a97",
  border: "rgba(55, 53, 47, 0.09)",
  borderStrong: "rgba(55, 53, 47, 0.16)",
  hoverWash: "rgba(55, 53, 47, 0.08)",
  bgPage: "#ffffff",
  bgSidebar: "#fbfbfa",
  bgSubtle: "#f7f6f3",
  accentBlue: "#2383e2",
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
};

// ── keyframe injection ────────────────────────────────────────────────────────
if (typeof document !== "undefined") {
  const id = "__notion_projects_styles";
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
      @keyframes cardIn {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes headerSlide {
        from { opacity: 0; transform: translateY(-6px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes shimmer {
        0%   { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }

      .project-card {
        transition: box-shadow 160ms ease, border-color 160ms ease,
                    transform 160ms ease, background 160ms ease !important;
      }
      .project-card:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(55,53,47,0.1) !important;
        transform: translateY(-1px) !important;
        background: ${notion.bgSidebar} !important;
        border-color: ${notion.borderStrong} !important;
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

      .topbar-fade {
        animation: headerSlide 0.35s ease forwards;
      }

      .new-btn:hover {
        background: #000 !important;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      }
      .new-btn {
        transition: background 150ms ease, transform 120ms ease, box-shadow 120ms ease !important;
      }
    `;
    document.head.appendChild(s);
  }
}

// ── skeleton card shown while loading ─────────────────────────────────────────
function SkeletonCard({ delay }: { delay: string }) {
  return (
    <div
      style={{
        background: notion.bgPage,
        border: `1px solid ${notion.border}`,
        borderRadius: 6,
        padding: "14px 16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: 0,
        animation: `cardIn 0.4s ease ${delay} forwards`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div className="skeleton" style={{ width: "55%", height: 14 }} />
        <div
          className="skeleton"
          style={{ width: 48, height: 18, borderRadius: 3 }}
        />
      </div>
      <div className="skeleton" style={{ width: "90%", height: 12 }} />
      <div className="skeleton" style={{ width: "70%", height: 12 }} />
      <div
        style={{
          marginTop: 8,
          paddingTop: 10,
          borderTop: `1px solid ${notion.border}`,
          display: "flex",
          gap: 8,
        }}
      >
        <div className="skeleton" style={{ width: 40, height: 11 }} />
        <div className="skeleton" style={{ width: 40, height: 11 }} />
        <div className="skeleton" style={{ width: 60, height: 11 }} />
      </div>
    </div>
  );
}

// ── badge ─────────────────────────────────────────────────────────────────────
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

// ── dot separator ─────────────────────────────────────────────────────────────
function Dot() {
  return (
    <span style={{ color: notion.borderStrong, userSelect: "none" }}>·</span>
  );
}

// ── project card ──────────────────────────────────────────────────────────────
function ProjectCard({
  project: p,
  onClick,
  animationDelay,
}: {
  project: ReturnType<typeof useStore>["projects"][number];
  onClick: () => void;
  animationDelay: string;
}) {
  return (
    <div
      className="project-card"
      onClick={onClick}
      style={{
        background: notion.bgPage,
        border: `1px solid ${notion.border}`,
        borderRadius: 6,
        padding: "14px 16px 12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        opacity: 0,
        animation: `cardIn 0.45s cubic-bezier(0.16,1,0.3,1) ${animationDelay} forwards`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 7,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: "-.1px",
            lineHeight: 1.4,
            color: notion.text,
          }}
        >
          {p.name}
        </h3>
        <div style={{ display: "flex", gap: 4, flexShrink: 0, marginTop: 1 }}>
          {p.finished && (
            <Badge label="Finished" color="#4f8a5b" bg="rgba(79,138,91,0.12)" />
          )}
          {p.myRole === "Admin" ? (
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

      {/* Description */}
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: notion.textMuted,
          lineHeight: 1.55,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          minHeight: 38,
        }}
      >
        {p.desc ? (
          p.desc
        ) : (
          <span style={{ color: notion.textFaint, fontStyle: "italic" }}>
            No description
          </span>
        )}
      </p>

      {/* Footer */}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: notion.textFaint,
          borderTop: `1px solid ${notion.border}`,
          paddingTop: 10,
        }}
      >
        <span>{p.filesCount} files</span>
        <Dot />
        <span>{p.size}</span>
        <Dot />
        <span>{p.created}</span>
      </div>
    </div>
  );
}

// ── empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "100px 20px",
        gap: 16,
        opacity: 0,
        animation: "fadeSlideIn 0.5s ease 0.2s forwards",
      }}
    >
      {/* Illustrated placeholder */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          background: notion.bgSubtle,
          border: `1.5px dashed ${notion.borderStrong}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          marginBottom: 4,
        }}
      >
        📂
      </div>

      <div style={{ textAlign: "center" }}>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: 15,
            fontWeight: 600,
            color: notion.text,
          }}
        >
          No projects yet
        </p>
        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            color: notion.textMuted,
            lineHeight: 1.6,
          }}
        >
          Create your first project to get started.
        </p>
      </div>

      <Hov
        as="button"
        onClick={onNew}
        style={{
          marginTop: 4,
          fontSize: 13,
          fontWeight: 500,
          color: "#fff",
          background: "#191919",
          border: "none",
          borderRadius: 4,
          padding: "8px 16px",
          cursor: "pointer",
          fontFamily: notion.font,
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "background 150ms ease",
        }}
        hoverStyle={{ background: "#000" }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
        New project
      </Hov>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function ProjectsHome() {
  const router = useRouter();
  const { me, projects, createProject, refresh, joinProject } = useStore();
  const [showNew, setShowNew] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    refresh()
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const logout = () => {
    clearAuth();
    router.push("/login");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: notion.bgSubtle,
        fontFamily: notion.font,
        color: notion.text,
      }}
    >
      {/* ── Top bar ── */}
      <header
        className="topbar-fade"
        style={{
          height: 52,
          background: notion.bgSidebar,
          borderBottom: `1px solid ${notion.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <Logo size="sm" />

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Avatar + name */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "3px 8px 3px 4px",
              borderRadius: 4,
              background: notion.bgSubtle,
            }}
          >
            {/* Mini avatar circle */}
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#9065b0",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {me?.[0]?.toUpperCase() ?? "?"}
            </div>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                color: notion.textMuted,
                maxWidth: 160,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {me}
            </span>
          </div>

          <Hov
            as="button"
            onClick={logout}
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: notion.textMuted,
              background: "transparent",
              border: `1px solid ${notion.border}`,
              borderRadius: 4,
              padding: "4px 10px",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 150ms ease, color 150ms ease",
            }}
            hoverStyle={{
              background: notion.hoverWash,
              color: notion.text,
            }}
          >
            Log out
          </Hov>
        </div>
      </header>

      {/* ── Main ── */}
      <main
        style={{
          maxWidth: 1020,
          margin: "0 auto",
          padding: "48px 32px 80px",
        }}
      >
        {/* Page heading */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 32,
            gap: 16,
            flexWrap: "wrap",
            opacity: 0,
            animation: "fadeSlideIn 0.4s ease 0.05s forwards",
          }}
        >
          <div>
            <h1
              style={{
                margin: "0 0 3px",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: "-.5px",
                color: notion.text,
                lineHeight: 1.2,
              }}
            >
              My Projects
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: notion.textMuted }}>
              {loading
                ? "Loading…"
                : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setShowJoin(true)}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: notion.textMuted,
                background: "transparent",
                border: `1px solid ${notion.border}`,
                borderRadius: 4,
                padding: "6px 12px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Join project
            </button>

            <button
              className="new-btn"
              onClick={() => setShowNew(true)}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#fff",
                background: "#191919",
                border: "none",
                borderRadius: 4,
                padding: "6px 13px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "inherit",
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1, marginTop: -1 }}>
                +
              </span>
              New project
            </button>
          </div>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          // Skeleton grid while data loads
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 10,
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} delay={`${i * 0.05}s`} />
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 10,
            }}
          >
            {projects.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => router.push(`/projects/${p.id}`)}
                animationDelay={`${i * 0.04}s`}
              />
            ))}
          </div>
        ) : (
          <EmptyState onNew={() => setShowNew(true)} />
        )}
      </main>

      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onCreate={(name, desc) => createProject(name, desc)}
        />
      )}
      {showJoin && (
        <JoinProjectModal
          onClose={() => setShowJoin(false)}
          onJoin={async (code) => {
            const projectId = await joinProject(code);
            router.push(`/projects/${projectId}`);
          }}
        />
      )}
    </div>
  );
}
