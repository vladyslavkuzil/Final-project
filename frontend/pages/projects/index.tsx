import { useState } from "react";
import { useRouter } from "next/router";
import { Hov, Logo } from "../../components/infoboard/ui";
import { NewProjectModal } from "../../components/infoboard/modals";
import { useStore } from "../../lib/store";

export default function ProjectsHome() {
  const router = useRouter();
  const { me, projects, createProject } = useStore();
  const [showNew, setShowNew] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5" }}>
      <header
        style={{
          height: 56,
          background: "#fff",
          borderBottom: "1px solid #ebebe8",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <Logo size="sm" />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontSize: 13, color: "#8b8a83" }}>{me}</span>
          <Hov
            as="button"
            onClick={() => router.push("/login")}
            style={{
              fontSize: 13,
              color: "#5c5b57",
              background: "#fff",
              border: "1px solid #e3e3df",
              borderRadius: 7,
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 500,
            }}
            hoverStyle={{ background: "#f4f4f2" }}
          >
            Log Out
          </Hov>
        </div>
      </header>

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "36px 24px 80px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 26,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-.5px" }}>My Projects</h1>
          <div style={{ display: "flex", gap: 10 }}>
            <div title="Coming soon" style={{ opacity: 0.5, cursor: "not-allowed", filter: "grayscale(1)" }}>
              <button
                disabled
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#5c5b57",
                  background: "#fff",
                  border: "1px solid #e3e3df",
                  borderRadius: 8,
                  padding: "8px 14px",
                  cursor: "not-allowed",
                  pointerEvents: "none",
                }}
              >
                Join Project
              </button>
            </div>
            <Hov
              as="button"
              onClick={() => setShowNew(true)}
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
              <span style={{ fontSize: 15, lineHeight: 1, marginTop: -1 }}>+</span>New Project
            </Hov>
          </div>
        </div>

        {projects.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
            {projects.map((p) => (
              <Hov
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}`)}
                style={{
                  background: "#fff",
                  border: "1px solid #ebebe8",
                  borderRadius: 12,
                  padding: "18px 18px 16px",
                  cursor: "pointer",
                  transition: "box-shadow .15s,transform .15s",
                  display: "flex",
                  flexDirection: "column",
                }}
                hoverStyle={{
                  boxShadow: "0 4px 16px rgba(15,15,15,.08)",
                  transform: "translateY(-2px)",
                  borderColor: "#e0dfd9",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 9,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 600, letterSpacing: "-.2px", lineHeight: 1.3 }}>
                    {p.name}
                  </h3>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {p.finished && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#1e7e45",
                          background: "#e6f4ea",
                          padding: "3px 8px",
                          borderRadius: 20,
                        }}
                      >
                        Finished
                      </span>
                    )}
                    {p.myRole === "Admin" ? (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#1a56db",
                          background: "#e8f0fe",
                          padding: "3px 8px",
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
                          padding: "3px 8px",
                          borderRadius: 20,
                        }}
                      >
                        Member
                      </span>
                    )}
                  </div>
                </div>
                <p
                  style={{
                    margin: "0 0 18px",
                    fontSize: 13,
                    color: "#8b8a83",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: 38,
                  }}
                >
                  {p.desc}
                </p>
                <div
                  style={{
                    marginTop: "auto",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: "#9b9a93",
                    borderTop: "1px solid #f0f0ee",
                    paddingTop: 12,
                  }}
                >
                  <span>{p.files.length} files</span>
                  <span style={{ color: "#d8d7d1" }}>·</span>
                  <span>{p.size}</span>
                  <span style={{ color: "#d8d7d1" }}>·</span>
                  <span>{p.created}</span>
                </div>
              </Hov>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "70px 20px" }}>
            <div
              style={{
                width: 120,
                height: 88,
                margin: "0 auto 20px",
                borderRadius: 12,
                border: "1px dashed #d6d5ce",
                background:
                  "repeating-linear-gradient(45deg,#f4f4f2,#f4f4f2 8px,#efefec 8px,#efefec 16px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: "11px ui-monospace,Menlo,monospace",
                color: "#b3b2ac",
              }}
            >
              empty
            </div>
            <p style={{ margin: 0, fontSize: 14.5, color: "#8b8a83" }}>No projects yet. Create one to get started.</p>
          </div>
        )}
      </main>

      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onCreate={(name, desc) => {
            createProject(name, desc);
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}
