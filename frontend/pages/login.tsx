import { useState } from "react";
import { useRouter } from "next/router";
import { FOCUS_RING, Hov, INPUT_STYLE, LABEL_STYLE, Logo } from "../components/infoboard/ui";
import { login } from "../lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.push("/projects");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5" }}>
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 384 }}>
          <div style={{ marginBottom: 28 }}>
            <Logo size="lg" />
          </div>
          <div
            style={{
              background: "#fff",
              border: "1px solid #ebebe8",
              borderRadius: 14,
              padding: "30px 30px 26px",
              boxShadow: "0 1px 3px rgba(15,15,15,.04),0 8px 24px rgba(15,15,15,.05)",
            }}
          >
            <h1 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, letterSpacing: "-.3px" }}>Welcome back</h1>
            <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "#8b8a83" }}>Log in to your workspace</p>
            <label style={LABEL_STYLE}>Email</label>
            <Hov
              as="input"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ ...INPUT_STYLE, marginBottom: 16 }}
              focusStyle={FOCUS_RING}
            />
            <label style={LABEL_STYLE}>Password</label>
            <Hov
              as="input"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && submit()}
              placeholder="••••••••"
              style={{ ...INPUT_STYLE, marginBottom: error ? 12 : 22 }}
              focusStyle={FOCUS_RING}
            />
            {error && (
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "#c0392b" }}>{error}</p>
            )}
            <Hov
              as="button"
              onClick={submit}
              disabled={busy}
              style={{
                width: "100%",
                padding: 10,
                background: "#2f6fed",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.7 : 1,
              }}
              hoverStyle={{ background: "#2560d8" }}
            >
              {busy ? "Logging in…" : "Log In"}
            </Hov>
          </div>
          <p style={{ textAlign: "center", margin: "18px 0 0", fontSize: 13.5, color: "#8b8a83" }}>
            Don&apos;t have an account?{" "}
            <a
              onClick={() => router.push("/register")}
              style={{ color: "#2f6fed", fontWeight: 500, cursor: "pointer", textDecoration: "none" }}
            >
              Register
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
