// Central API client: a thin fetch wrapper that attaches the Bearer token
// from localStorage on every request and normalizes error handling.

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

const TOKEN_KEY = "access_token";
const EMAIL_KEY = "user_email";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getMyEmail(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(EMAIL_KEY) ?? "";
}

export function setMyEmail(email: string): void {
  localStorage.setItem(EMAIL_KEY, email);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function extractDetail(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    // Pydantic validation errors arrive as a list of {msg, loc, ...}.
    if (Array.isArray(detail)) {
      return detail.map((d) => (d?.msg ? String(d.msg) : String(d))).join(", ");
    }
  }
  return fallback;
}

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Let the browser set the multipart boundary for FormData bodies.
  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = extractDetail(await res.json(), detail);
    } catch {
      // Non-JSON error body — keep the status text.
    }
    throw new ApiError(res.status, detail);
  }
  return res;
}

// Parse a JSON body, tolerating empty/204 responses (e.g. leave-project),
// which have nothing to parse and would otherwise throw on res.json().
async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => request(path).then((r) => parseJson<T>(r)),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request(path, { method: "POST", body: JSON.stringify(body ?? {}) }).then((r) =>
      parseJson<T>(r)
    ),
  put: <T>(path: string, body?: unknown): Promise<T> =>
    request(path, { method: "PUT", body: JSON.stringify(body ?? {}) }).then((r) =>
      parseJson<T>(r)
    ),
  del: (path: string): Promise<Response> => request(path, { method: "DELETE" }),
  postForm: <T>(path: string, form: FormData): Promise<T> =>
    request(path, { method: "POST", body: form }).then((r) => parseJson<T>(r)),
  blob: (path: string): Promise<Blob> => request(path).then((r) => r.blob()),
};

// --- Auth -----------------------------------------------------------------

type TokenResponse = { access_token: string; refresh_token: string; token_type: string };

export async function login(email: string, password: string): Promise<void> {
  // The backend login endpoint expects OAuth2 form-encoded credentials.
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    let detail = "Incorrect email or password";
    try {
      detail = extractDetail(await res.json(), detail);
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, detail);
  }
  const data: TokenResponse = await res.json();
  setToken(data.access_token);
  setMyEmail(email);
}

export async function register(email: string, password: string): Promise<void> {
  await request("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  // Register returns no token, so log in immediately to obtain one.
  await login(email, password);
}
