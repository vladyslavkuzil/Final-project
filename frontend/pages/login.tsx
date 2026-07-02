import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Hov, Logo } from "../components/infoboard/ui";
import { login } from "../lib/api";

const notion = {
  text: "#37352f",
  textMuted: "#787774",
  textFaint: "#9b9a97",
  border: "rgba(55, 53, 47, 0.09)",
  borderStrong: "rgba(55, 53, 47, 0.16)",
  hoverWash: "rgba(55, 53, 47, 0.08)",
  bgPage: "#ffffff",
  bgSubtle: "#f7f6f3",
  accentBlue: "#2383e2",
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
};

// ── keyframe injection ────────────────────────────────────────────────────────
// We inject once at module level so it's never duplicated.
if (typeof document !== "undefined") {
  const id = "__notion_auth_styles";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      @keyframes fadeSlideIn {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes shake {
        0%,100% { transform: translateX(0); }
        20%     { transform: translateX(-6px); }
        40%     { transform: translateX(6px); }
        60%     { transform: translateX(-4px); }
        80%     { transform: translateX(4px); }
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      @keyframes errorSlide {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* Subtle animated gradient background */
      .auth-bg {
        background: linear-gradient(135deg, #f7f6f3 0%, #efefec 50%, #f7f6f3 100%);
        background-size: 400% 400%;
        animation: gradientShift 12s ease infinite;
      }
      @keyframes gradientShift {
        0%   { background-position: 0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      /* Input placeholder color */
      .auth-input::placeholder { color: #c4c3be; }
      .auth-input::-webkit-input-placeholder { color: #c4c3be; }

      /* Smooth autofill override so Chrome's yellow doesn't break the style */
      .auth-input:-webkit-autofill,
      .auth-input:-webkit-autofill:focus {
        transition: background-color 9999s ease-in-out 0s;
        -webkit-text-fill-color: #37352f !important;
      }
    `;
    document.head.appendChild(s);
  }
}

// ── spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid rgba(255,255,255,0.35)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
        verticalAlign: "middle",
        marginRight: 8,
      }}
    />
  );
}

// ── field ─────────────────────────────────────────────────────────────────────
function Field({
  label,
  type,
  value,
  placeholder,
  onChange,
  onKeyDown,
  autoFocus,
  animationDelay = "0ms",
}: {
  label: string;
  type: string;
  value: string;
  placeholder: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  animationDelay?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [hasValue, setHasValue] = useState(false);

  return (
    <div
      style={{
        marginBottom: 16,
        opacity: 0,
        animation: "fadeSlideIn 0.4s ease forwards",
        animationDelay,
      }}
    >
      {/* Floating-style label that shifts up when focused or filled */}
      <label
        style={{
          display: "block",
          fontSize: 11.5,
          fontWeight: 600,
          letterSpacing: ".4px",
          textTransform: "uppercase",
          marginBottom: 6,
          color: focused ? notion.accentBlue : notion.textMuted,
          transition: "color 150ms ease",
        }}
      >
        {label}
      </label>

      <div style={{ position: "relative" }}>
        <input
          className="auth-input"
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => {
            setHasValue(e.target.value.length > 0);
            onChange(e);
          }}
          onKeyDown={onKeyDown}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            display: "block",
            width: "100%",
            boxSizing: "border-box",
            padding: "9px 12px",
            fontSize: 14,
            color: notion.text,
            background: focused ? notion.bgPage : notion.bgSubtle,
            border: `1.5px solid ${
              focused ? notion.accentBlue : notion.border
            }`,
            borderRadius: 5,
            outline: "none",
            fontFamily: "inherit",
            transition: "border-color 150ms ease, background 150ms ease, box-shadow 150ms ease",
            boxShadow: focused
              ? "0 0 0 3px rgba(35,131,226,0.12), 0 1px 3px rgba(0,0,0,0.04)"
              : "0 1px 2px rgba(0,0,0,0.03)",
          }}
        />

        {/* Checkmark when field has a value and is not focused */}
        {hasValue && !focused && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#4f8a5b",
              fontSize: 13,
              opacity: 0,
              animation: "fadeIn 0.2s ease forwards",
            }}
          >
            ✓
          </span>
        )}
      </div>
    </div>
  );
}

// ── divider ───────────────────────────────────────────────────────────────────
function Divider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        margin: "20px 0",
        opacity: 0,
        animation: "fadeIn 0.4s ease 0.35s forwards",
      }}
    >
      <div style={{ flex: 1, height: 1, background: notion.border }} />
      <span style={{ fontSize: 11.5, color: notion.textFaint, letterSpacing: ".3px" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: notion.border }} />
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Trigger mount animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      router.push("/projects");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Login failed.";
      setError(msg);
      // Shake the card on error
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="auth-bg"
      style={{
        minHeight: "100vh",
        fontFamily: notion.font,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          opacity: 0,
          animation: "fadeSlideIn 0.5s cubic-bezier(0.16,1,0.3,1) 0.05s forwards",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 28,
            opacity: 0,
            animation: "fadeSlideIn 0.4s ease forwards",
          }}
        >
          <Logo size="lg" />
        </div>

        {/* Card */}
        <div
          style={{
            background: notion.bgPage,
            border: `1px solid ${notion.border}`,
            borderRadius: 8,
            padding: "32px 32px 28px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)",
            animation: shake ? "shake 0.45s ease" : undefined,
          }}
        >
          {/* Header */}
          <div
            style={{
              marginBottom: 26,
              opacity: 0,
              animation: "fadeSlideIn 0.4s ease 0.1s forwards",
            }}
          >
            <h1
              style={{
                margin: "0 0 4px",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-.4px",
                color: notion.text,
              }}
            >
              Welcome back
            </h1>
            <p style={{ margin: 0, fontSize: 13.5, color: notion.textMuted, lineHeight: 1.5 }}>
              Log in to your workspace to continue.
            </p>
          </div>

          {/* Fields */}
          <Field
            label="Email"
            type="email"
            value={email}
            placeholder="you@example.com"
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            animationDelay="0.15s"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            placeholder="••••••••"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            animationDelay="0.2s"
          />

          {/* Error */}
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                margin: "0 0 16px",
                padding: "10px 12px",
                background: "rgba(235,87,87,0.07)",
                border: "1px solid rgba(235,87,87,0.2)",
                borderRadius: 5,
                animation: "errorSlide 0.25s ease",
              }}
            >
              <span style={{ fontSize: 14, marginTop: 1 }}>⚠️</span>
              <p style={{ margin: 0, fontSize: 13, color: "#c0392b", lineHeight: 1.5 }}>
                {error}
              </p>
            </div>
          )}

          {/* Submit */}
          <div
            style={{
              opacity: 0,
              animation: "fadeSlideIn 0.4s ease 0.25s forwards",
            }}
          >
            <Hov
              as="button"
              onClick={submit}
              disabled={busy}
              style={{
                width: "100%",
                padding: "10px 0",
                background: busy ? "#555" : "#191919",
                color: "#fff",
                border: "none",
                borderRadius: 5,
                fontSize: 14,
                fontWeight: 500,
                cursor: busy ? "default" : "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 150ms ease, transform 100ms ease",
                letterSpacing: ".1px",
              }}
              hoverStyle={busy ? {} : {
                background: "#000",
                transform: "translateY(-1px)",
              }}
            >
              {busy && <Spinner />}
              {busy ? "Logging in…" : "Log in"}
            </Hov>
          </div>

          <Divider label="or" />

          {/* Register CTA — inside the card, below the divider */}
          <div
            style={{
              opacity: 0,
              animation: "fadeSlideIn 0.4s ease 0.4s forwards",
            }}
          >
            <Hov
              as="button"
              onClick={() => router.push("/register")}
              style={{
                width: "100%",
                padding: "9px 0",
                background: "transparent",
                color: notion.text,
                border: `1.5px solid ${notion.border}`,
                borderRadius: 5,
                fontSize: 13.5,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "border-color 150ms ease, background 150ms ease",
                letterSpacing: ".1px",
              }}
              hoverStyle={{
                background: notion.hoverWash,
                borderColor: notion.borderStrong,
              }}
            >
              Create an account
            </Hov>
          </div>
        </div>
      </div>
    </div>
  );
}