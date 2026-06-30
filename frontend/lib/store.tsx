import React, { createContext, useContext, useState } from "react";

export type Role = "Admin" | "Member";

export type Member = {
  email: string;
  role: Role;
  active: boolean;
};

export type FileItem = {
  name: string;
  ext: string;
  color: string;
  size: string;
  by: string;
  date: string;
};

export type Project = {
  id: string;
  name: string;
  desc: string;
  size: string;
  created: string;
  finished: boolean;
  myRole: Role;
  members: Member[];
  files: FileItem[];
};

const SEED_PROJECTS: Project[] = [
  {
    id: "alpha",
    name: "Project Alpha",
    desc: "Main product documentation",
    size: "2.3 MB",
    created: "Jan 2026",
    finished: false,
    myRole: "Admin",
    members: [
      { email: "alex@example.com", role: "Admin", active: true },
      { email: "sara@example.com", role: "Member", active: true },
    ],
    files: [
      { name: "requirements.pdf", ext: "PDF", color: "#d4493f", size: "420 KB", by: "alex@example.com", date: "2026-01-15" },
      { name: "wireframes.fig", ext: "FIG", color: "#a259ff", size: "1.1 MB", by: "sara@example.com", date: "2026-02-03" },
      { name: "meeting-notes.docx", ext: "DOC", color: "#2b7de9", size: "88 KB", by: "alex@example.com", date: "2026-03-10" },
      { name: "budget.xlsx", ext: "XLS", color: "#1e8e4e", size: "210 KB", by: "sara@example.com", date: "2026-04-22" },
    ],
  },
  {
    id: "beta",
    name: "Project Beta",
    desc: "Q2 research archive",
    size: "8.1 MB",
    created: "Mar 2026",
    finished: true,
    myRole: "Member",
    members: [
      { email: "owner@example.com", role: "Admin", active: true },
      { email: "alex@example.com", role: "Member", active: true },
    ],
    files: [
      { name: "research-survey-q2.pdf", ext: "PDF", color: "#d4493f", size: "1.4 MB", by: "owner@example.com", date: "2026-03-04" },
      { name: "interview-transcripts.docx", ext: "DOC", color: "#2b7de9", size: "640 KB", by: "owner@example.com", date: "2026-03-09" },
      { name: "data-analysis.xlsx", ext: "XLS", color: "#1e8e4e", size: "2.2 MB", by: "alex@example.com", date: "2026-03-15" },
      { name: "competitor-landscape.pdf", ext: "PDF", color: "#d4493f", size: "880 KB", by: "owner@example.com", date: "2026-03-18" },
      { name: "user-personas.fig", ext: "FIG", color: "#a259ff", size: "1.3 MB", by: "alex@example.com", date: "2026-03-22" },
      { name: "findings-deck.pdf", ext: "PDF", color: "#d4493f", size: "960 KB", by: "owner@example.com", date: "2026-03-28" },
      { name: "raw-data.csv", ext: "CSV", color: "#5c5b57", size: "320 KB", by: "alex@example.com", date: "2026-04-02" },
      { name: "methodology.docx", ext: "DOC", color: "#2b7de9", size: "120 KB", by: "owner@example.com", date: "2026-04-06" },
      { name: "executive-summary.pdf", ext: "PDF", color: "#d4493f", size: "210 KB", by: "owner@example.com", date: "2026-04-12" },
      { name: "charts-export.xlsx", ext: "XLS", color: "#1e8e4e", size: "540 KB", by: "alex@example.com", date: "2026-04-19" },
      { name: "appendix.pdf", ext: "PDF", color: "#d4493f", size: "180 KB", by: "owner@example.com", date: "2026-04-25" },
    ],
  },
];

type Store = {
  me: string;
  projects: Project[];
  createProject: (name: string, desc: string) => void;
  deleteProject: (id: string) => void;
  leaveProject: (id: string) => void;
  deleteFile: (projectId: string, name: string) => void;
  renameFile: (projectId: string, name: string, next: string) => void;
  uploadFile: (projectId: string) => void;
  saveSettings: (projectId: string, patch: { name: string; desc: string; finished: boolean }) => void;
  sendInvite: (projectId: string, userId: string) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const me = "alex@example.com";
  const [projects, setProjects] = useState<Project[]>(SEED_PROJECTS);

  const createProject = (name: string, desc: string) => {
    const proj: Project = {
      id: "p" + Date.now(),
      name,
      desc,
      size: "0 KB",
      created: "Jun 2026",
      finished: false,
      myRole: "Admin",
      members: [{ email: me, role: "Admin", active: true }],
      files: [],
    };
    setProjects((ps) => [...ps, proj]);
  };

  const deleteProject = (id: string) => setProjects((ps) => ps.filter((p) => p.id !== id));

  const leaveProject = (id: string) => setProjects((ps) => ps.filter((p) => p.id !== id));

  const deleteFile = (projectId: string, name: string) =>
    setProjects((ps) =>
      ps.map((p) => (p.id === projectId ? { ...p, files: p.files.filter((f) => f.name !== name) } : p))
    );

  const renameFile = (projectId: string, name: string, next: string) =>
    setProjects((ps) =>
      ps.map((p) =>
        p.id === projectId
          ? { ...p, files: p.files.map((f) => (f.name === name ? { ...f, name: next } : f)) }
          : p
      )
    );

  const uploadFile = (projectId: string) => {
    const f: FileItem = {
      name: "untitled-document.pdf",
      ext: "PDF",
      color: "#d4493f",
      size: "0 KB",
      by: me,
      date: "2026-06-29",
    };
    setProjects((ps) => ps.map((p) => (p.id === projectId ? { ...p, files: [...p.files, f] } : p)));
  };

  const saveSettings = (projectId: string, patch: { name: string; desc: string; finished: boolean }) =>
    setProjects((ps) =>
      ps.map((p) =>
        p.id === projectId
          ? { ...p, name: patch.name.trim() || p.name, desc: patch.desc.trim(), finished: patch.finished }
          : p
      )
    );

  const sendInvite = (projectId: string, userId: string) =>
    setProjects((ps) =>
      ps.map((p) =>
        p.id === projectId
          ? { ...p, members: [...p.members, { email: userId, role: "Member", active: false }] }
          : p
      )
    );

  return (
    <StoreContext.Provider
      value={{
        me,
        projects,
        createProject,
        deleteProject,
        leaveProject,
        deleteFile,
        renameFile,
        uploadFile,
        saveSettings,
        sendInvite,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
