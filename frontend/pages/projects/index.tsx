import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Hov, Logo } from "../../components/infoboard/ui";
import { NewProjectModal } from "../../components/infoboard/modals";
import { useStore } from "../../lib/store";
import { clearAuth, getToken } from "../../lib/api";

// ── shared token object (ideally imported from a theme file) ──────────────────
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

// ── tiny badge helper ─────────────────────────────────────────────────────────
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
        borderRadius: 3, // Notion uses very small radii on tags
        letterSpacing: ".1px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default function ProjectsHome() {
  const router = useRouter();
  const { me, projects, createProject, refresh } = useStore();
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    refresh().catch(() => {});
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
        style={{
          height: 52,
          background: notion.bgSidebar,
          borderBottom: `1px solid ${notion.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Logo size="sm" />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* User pill — matches the status pill in ProjectChatPanel */}
          <span
            style={{
              fontSize: 12.5,
              fontWeight: 500,
              color: notion.textMuted,
              background: notion.bgSubtle,
              borderRadius: 4,
              padding: "4px 8px",
            }}
          >
            {me}
          </span>

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
            }}
            hoverStyle={{ background: notion.hoverWash }}
          >
            Log out
          </Hov>
        </div>
      </header>

      {/* ── Page body ── */}
      <main
        style={{
          maxWidth: 1000,
          margin: "0 auto",
          padding: "44px 32px 80px",
        }}
      >
        {/* Page title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 28,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-.3px",
                color: notion.text,
              }}
            >
              My Projects
            </h1>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: 13,
                color: notion.textMuted,
              }}
            >
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            {/* Disabled "Join" — kept but styled consistently */}
            <button
              disabled
              title="Coming soon"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: notion.textFaint,
                background: "transparent",
                border: `1px solid ${notion.border}`,
                borderRadius: 4,
                padding: "6px 12px",
                cursor: "not-allowed",
                opacity: 0.5,
                fontFamily: "inherit",
              }}
            >
              Join project
            </button>

            <Hov
              as="button"
              onClick={() => setShowNew(true)}
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#fff",
                background: "#191919", // matches the Send button in chat
                border: "none",
                borderRadius: 4,
                padding: "6px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "inherit",
              }}
              hoverStyle={{ background: "#000" }}
            >
              <span style={{ fontSize: 16, lineHeight: 1, marginTop: -1 }}>+</span>
              New project
            </Hov>
          </div>
        </div>

        {/* ── Project grid ── */}
        {projects.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 10, // Notion uses tighter gaps than typical card grids
            }}
          >
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onClick={() => router.push(`/projects/${p.id}`)}
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
    </div>
  );
}

// ── Project card ──────────────────────────────────────────────────────────────
// Extracted so the parent render stays readable.
function ProjectCard({
  project: p,
  onClick,
}: {
  project: ReturnType<typeof useStore>["projects"][number];
  onClick: () => void;
}) {
  return (
    <Hov
      onClick={onClick}
      style={{
        background: notion.bgPage,
        border: `1px solid ${notion.border}`,
        borderRadius: 6, // Notion uses 6px, not 12px
        padding: "14px 16px 12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        transition: "background 100ms ease",
      }}
      hoverStyle={{
        background: notion.bgSidebar,
        borderColor: notion.borderStrong,
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 6,
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
            <Badge label="Admin" color={notion.accentBlue} bg="rgba(35,131,226,0.1)" />
          ) : (
            <Badge label="Member" color={notion.textMuted} bg={notion.bgSubtle} />
          )}
        </div>
      </div>

      {/* Description */}
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          color: notion.textMuted,
          lineHeight: 1.5,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          minHeight: 36,
        }}
      >
        {p.desc || (
          <span style={{ color: notion.textFaint, fontStyle: "italic" }}>
            No description
          </span>
        )}
      </p>

      {/* Footer meta */}
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
    </Hov>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "80px 20px",
        gap: 14,
      }}
    >
      {/* Notion-style dashed placeholder block */}
      <div
        style={{
          width: 100,
          height: 72,
          borderRadius: 6,
          border: `1px dashed ${notion.borderStrong}`,
          background: notion.bgSubtle,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontFamily: "ui-monospace, Menlo, monospace",
          color: notion.textFaint,
          letterSpacing: ".5px",
        }}
      >
        empty
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: notion.textMuted,
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        No projects yet.
      </p>

      <Hov
        as="button"
        onClick={onNew}
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: notion.textMuted,
          background: "transparent",
          border: `1px solid ${notion.border}`,
          borderRadius: 4,
          padding: "6px 14px",
          cursor: "pointer",
          fontFamily: notion.font,
        }}
        hoverStyle={{ background: notion.hoverWash }}
      >
        Create your first project
      </Hov>
    </div>
  );
}

// ── Tiny separator dot ────────────────────────────────────────────────────────
function Dot() {
  return (
    <span style={{ color: notion.border, userSelect: "none" }}>·</span>
  );
}