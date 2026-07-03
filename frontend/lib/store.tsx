import React, { createContext, useContext, useEffect, useState } from "react";
import { api, ApiError, getMyEmail, getToken } from "./api";

export type Role = "Admin" | "Member";

export type Member = {
  email: string;
  role: Role;
  active: boolean;
};

export type FileItem = {
  id: string;
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
  filesCount: number;
  created: string;
  finished: boolean;
  myRole: Role;
  members: Member[];
  files: FileItem[];
};

// --- Backend response shapes ---------------------------------------------

type ApiUser = { id: string; email: string; is_active: boolean };

type ApiProject = {
  id: string;
  name: string;
  description: string | null;
  documents_count: number;
  total_size_bytes: number;
  created_at: string;
  is_finished: boolean;
  user_role?: string | null;
};

type ApiDocument = {
  id: string;
  title: string;
  file_path: string;
  uploaded_by: string;
  size_bytes: number;
  created_at: string;
};

// --- Mapping helpers ------------------------------------------------------

const EXT_COLORS: Record<string, string> = {
  PDF: "#d4493f",
  DOC: "#2b7de9",
  DOCX: "#2b7de9",
  XLS: "#1e8e4e",
  XLSX: "#1e8e4e",
  CSV: "#5c5b57",
  FIG: "#a259ff",
  TXT: "#6b6b67",
};

function fileMeta(filename: string): { ext: string; color: string } {
  const raw = (filename.split(".").pop() ?? "").toUpperCase();
  const ext = raw.length > 4 || raw === "" ? "FILE" : raw;
  return { ext, color: EXT_COLORS[ext] ?? "#8b8a83" };
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatMonthYear(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function formatDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function mapProject(p: ApiProject, me: string): Project {
  let myRole: Role;
  if (p.user_role === "owner") myRole = "Admin";
  else if (p.user_role === "participant") myRole = "Member";
  else myRole = "Member";
  return {
    id: p.id,
    name: p.name,
    desc: p.description ?? "",
    size: formatBytes(p.total_size_bytes),
    filesCount: p.documents_count,
    created: formatMonthYear(p.created_at),
    finished: p.is_finished,
    myRole,
    members: [],
    files: [],
  };
}

// --- Store ----------------------------------------------------------------

type Store = {
  me: string;
  projects: Project[];
  loaded: boolean;
  refresh: () => Promise<void>;
  createProject: (name: string, desc: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  leaveProject: (id: string) => Promise<void>;
  loadProjectById: (id: string) => Promise<void>;
  loadProjectDocuments: (projectId: string) => Promise<void>;
  deleteFile: (projectId: string, docId: string) => Promise<void>;
  renameFile: (
    projectId: string,
    docId: string,
    title: string,
  ) => Promise<void>;
  uploadFile: (projectId: string, file: File, title: string) => Promise<void>;
  downloadFile: (
    projectId: string,
    docId: string,
    name: string,
  ) => Promise<void>;
  saveSettings: (
    projectId: string,
    patch: { name: string; desc: string; finished: boolean },
  ) => Promise<void>;
  inviteByEmail: (projectId: string, email: string) => Promise<void>;
  generateJoinCode: (projectId: string) => Promise<string>;
  joinProject: (code: string) => Promise<string>;
  removeMember: (projectId: string, userId: string) => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Maps a user id -> email so document "uploaded_by" ids can be shown nicely.
  const [userEmails, setUserEmails] = useState<Record<string, string>>({});

  const refresh = async () => {
    const current = getMyEmail();
    setMe(current);
    if (!getToken()) return;
    try {
      const data = await api.get<ApiProject[]>("/projects");
      setProjects(data.map((p) => mapProject(p, current)));
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    refresh().catch(() => {
      /* Pages guard their own auth redirects. */
    });
  }, []);

  const createProject = async (name: string, desc: string) => {
    await api.post("/projects", { name, description: desc });
    await refresh();
  };

  const deleteProject = async (id: string) => {
    await api.del(`/project/${id}`);
    await refresh();
  };

  const leaveProject = async (id: string) => {
    await api.post(`/project/${id}/leave`);
    await refresh();
  };

  const loadProjectById = async (id: string) => {
    const current = getMyEmail();
    const data = await api.get<ApiProject>(`/project/by-id/${id}/info`);
    setProjects((ps) =>
      ps.map((p) => (p.id === id ? mapProject(data, current) : p)),
    );
  };

  const loadProjectDocuments = async (projectId: string) => {
    const [docs, membersData] = await Promise.all([
      api.get<ApiDocument[]>(`/project/${projectId}/documents`),
      api.get<{ users: { id: string; email: string }[] }>(
        `/project/${projectId}/members`,
      ),
    ]);
    const emailMap: Record<string, string> = {};
    for (const u of membersData.users) {
      emailMap[u.id] = u.email;
    }
    setUserEmails(emailMap);
    const totalBytes = docs.reduce((sum, d) => sum + (d.size_bytes ?? 0), 0);
    const files: FileItem[] = docs.map((d) => {
      const { ext, color } = fileMeta(d.file_path || d.title);
      return {
        id: d.id,
        name: d.title,
        ext,
        color,
        size: formatBytes(d.size_bytes ?? 0),
        by: emailMap[d.uploaded_by] ?? d.uploaded_by,
        date: formatDate(d.created_at),
      };
    });
    setProjects((ps) =>
      ps.map((p) =>
        p.id === projectId
          ? { ...p, files, filesCount: files.length, size: formatBytes(totalBytes) }
          : p,
      ),
    );
  };

  const deleteFile = async (projectId: string, docId: string) => {
    await api.del(`/project/${projectId}/documents/${docId}`);
    await loadProjectDocuments(projectId);
  };

  const renameFile = async (
    projectId: string,
    docId: string,
    title: string,
  ) => {
    await api.put(`/project/${projectId}/documents/${docId}`, { title });
    await loadProjectDocuments(projectId);
  };

  const uploadFile = async (projectId: string, file: File, title: string) => {
    const form = new FormData();
    form.append("title", title);
    form.append("file", file);
    await api.postForm(`/project/${projectId}/documents`, form);
    await loadProjectDocuments(projectId);
  };

  const downloadFile = async (
    projectId: string,
    docId: string,
    name: string,
  ) => {
    const blob = await api.blob(`/project/${projectId}/documents/${docId}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const saveSettings = async (
    projectId: string,
    patch: { name: string; desc: string; finished: boolean },
  ) => {
    await api.put(`/project/${projectId}/info`, {
      name: patch.name.trim() || undefined,
      description: patch.desc.trim(),
      is_finished: patch.finished,
    });
    await refresh();
  };

  const generateJoinCode = async (projectId: string): Promise<string> => {
    const data = await api.post<{ code: string }>(
      `/project/${projectId}/join-code`,
      {},
    );
    return data.code;
  };

  const joinProject = async (code: string): Promise<string> => {
    const data = await api.post<{ project_id: string }>(
      `/join/${encodeURIComponent(code)}`,
    );
    await refresh();
    return data.project_id;
  };

  const removeMember = async (projectId: string, userId: string) => {
    await api.del(`/project/${projectId}/members/${userId}`);
    await refresh();
  };

  const inviteByEmail = async (projectId: string, email: string) => {
    await api.post(`/project/${projectId}/invite`, { email });
    await refresh();
  };

  return (
    <StoreContext.Provider
      value={{
        me,
        projects,
        loaded,
        refresh,
        createProject,
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
        joinProject,
        removeMember,
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
