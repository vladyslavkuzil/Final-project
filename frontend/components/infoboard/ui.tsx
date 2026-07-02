import React, { useEffect, useRef, useState } from "react";

// ── design tokens ─────────────────────────────────────────────────────────────
// Single source of truth. Every other file should import from here.
export const notion = {
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
  primary: "#191919",
  primaryHover: "#000000",
  danger: "#eb5757",
  toggleOn: "#22a559",
  toggleOff: "#d8d7d1",
  font: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
};

// ── global styles ─────────────────────────────────────────────────────────────
// Injected once at module load. All keyframes and shared CSS classes live here
// so every component in the app can use them without re-declaring.
if (typeof document !== "undefined") {
  const id = "__ib_global_styles";
  if (!document.getElementById(id)) {
    const s = document.createElement("style");
    s.id = id;
    s.textContent = `
      *, *::before, *::after { box-sizing: border-box; }

      /* ── Keyframes ── */
      @keyframes ib-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes ib-slide-up {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes ib-modal-backdrop {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes ib-modal-card {
        from { opacity: 0; transform: scale(0.97) translateY(6px); }
        to   { opacity: 1; transform: scale(1)    translateY(0);   }
      }
      @keyframes ib-shake {
        0%,100% { transform: translateX(0); }
        20%     { transform: translateX(-6px); }
        40%     { transform: translateX(6px); }
        60%     { transform: translateX(-4px); }
        80%     { transform: translateX(4px); }
      }
      @keyframes ib-spin {
        to { transform: rotate(360deg); }
      }
      @keyframes ib-error-slide {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes ib-shimmer {
        0%   { background-position: -400px 0; }
        100% { background-position:  400px 0; }
      }
      @keyframes ib-gradient-shift {
        0%   { background-position: 0%   50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0%   50%; }
      }

      /* ── Utility classes ── */

      /* Skeleton shimmer */
      .ib-skeleton {
        background: linear-gradient(
          90deg,
          ${notion.bgSubtle} 25%,
          #ececea 50%,
          ${notion.bgSubtle} 75%
        );
        background-size: 400px 100%;
        animation: ib-shimmer 1.4s ease infinite;
        border-radius: 4px;
      }

      /* Animated page background used on auth pages */
      .ib-auth-bg {
        background: linear-gradient(135deg, #f7f6f3 0%, #efefec 50%, #f7f6f3 100%);
        background-size: 400% 400%;
        animation: ib-gradient-shift 12s ease infinite;
      }

      /* Input shared style — used in modals and auth pages */
      .ib-input {
        display: block;
        width: 100%;
        box-sizing: border-box;
        padding: 8px 11px;
        font-size: 14px;
        font-family: inherit;
        color: ${notion.text};
        background: ${notion.bgSubtle};
        border: 1.5px solid ${notion.border};
        border-radius: 5px;
        outline: none;
        resize: none;
        transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
      }
      .ib-input:focus {
        background: ${notion.bgPage};
        border-color: ${notion.accentBlue};
        box-shadow: 0 0 0 3px rgba(35,131,226,0.12);
      }
      .ib-input::placeholder { color: #c4c3be; }
      .ib-input:-webkit-autofill,
      .ib-input:-webkit-autofill:focus {
        transition: background-color 9999s ease-in-out 0s;
        -webkit-text-fill-color: ${notion.text} !important;
      }

      /* Primary button */
      .ib-btn-primary {
        font-size: 13px;
        font-weight: 500;
        color: #fff;
        background: ${notion.primary};
        border: none;
        border-radius: 4px;
        padding: 7px 14px;
        cursor: pointer;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 150ms ease, transform 100ms ease, box-shadow 100ms ease;
        white-space: nowrap;
      }
      .ib-btn-primary:hover:not(:disabled) {
        background: ${notion.primaryHover};
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      }
      .ib-btn-primary:disabled { opacity: 0.55; cursor: default; }

      /* Secondary / cancel button */
      .ib-btn-secondary {
        font-size: 13px;
        font-weight: 500;
        color: ${notion.text};
        background: ${notion.bgPage};
        border: 1px solid ${notion.borderStrong};
        border-radius: 4px;
        padding: 7px 14px;
        cursor: pointer;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 150ms ease, border-color 150ms ease;
        white-space: nowrap;
      }
      .ib-btn-secondary:hover { background: ${notion.bgSubtle}; }

      /* Danger button */
      .ib-btn-danger {
        font-size: 13px;
        font-weight: 500;
        color: ${notion.danger};
        background: transparent;
        border: 1px solid ${notion.border};
        border-radius: 4px;
        padding: 7px 14px;
        cursor: pointer;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 150ms ease, border-color 150ms ease;
        white-space: nowrap;
      }
      .ib-btn-danger:hover { background: #fdf2f1; border-color: #e8b9b3; }

      /* Icon button — small square action button */
      .ib-btn-icon {
        width: 26px;
        height: 26px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        color: ${notion.textMuted};
        transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
        padding: 0;
        flex-shrink: 0;
      }
      .ib-btn-icon:hover {
        background: ${notion.bgSubtle};
        border-color: ${notion.border};
        color: ${notion.text};
      }
      .ib-btn-icon.danger:hover {
        background: #fdf2f1;
        border-color: #e8b9b3;
        color: #c0392b;
      }

      /* Nav item — sidebar navigation link */
      .ib-nav-item {
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
        border: none;
        background: transparent;
        font-family: inherit;
        width: 100%;
        text-align: left;
      }
      .ib-nav-item:hover  {
        background: ${notion.hoverWash};
        color: ${notion.text};
      }
      .ib-nav-item.active {
        background: ${notion.hoverWash};
        color: ${notion.text};
        font-weight: 600;
      }

      /* File / member table row */
      .ib-row {
        transition: background 100ms ease;
      }
      .ib-row:hover { background: ${notion.hoverWash} !important; }

      /* Error banner */
      .ib-error-banner {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 9px 12px;
        background: rgba(235,87,87,0.07);
        border: 1px solid rgba(235,87,87,0.22);
        border-radius: 5px;
        animation: ib-error-slide 0.22s ease;
      }

      /* Topbar backdrop blur */
      .ib-topbar {
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
    `;
    document.head.appendChild(s);
  }
}

// ── legacy style exports ──────────────────────────────────────────────────────
// Kept for any file that still imports them. Migrate callers to CSS classes
// above and remove these once everything is updated.
export const FOCUS_RING: React.CSSProperties = {
  borderColor: notion.accentBlue,
  boxShadow: `0 0 0 2px rgba(35,131,226,0.18)`,
};
export const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  border: `1.5px solid ${notion.border}`,
  borderRadius: 5,
  fontSize: 14,
  color: notion.text,
  background: notion.bgSubtle,
  outline: "none",
  fontFamily: notion.font,
};
export const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 600,
  letterSpacing: ".4px",
  textTransform: "uppercase" as const,
  color: notion.textMuted,
  marginBottom: 6,
};
export const ERROR_STYLE: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 13,
  color: "#c0392b",
};

// ── Hov ───────────────────────────────────────────────────────────────────────
// Renders any element with hover/focus style merging via React state.
// For most new code prefer CSS classes (above) — they're smoother and
// don't cause re-renders. Keep Hov for cases where the hover style is
// truly dynamic (e.g. depends on a prop value).
type HovProps = {
  as?: React.ElementType;
  style?: React.CSSProperties;
  hoverStyle?: React.CSSProperties;
  focusStyle?: React.CSSProperties;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  onFocus?: (e: React.FocusEvent) => void;
  onBlur?: (e: React.FocusEvent) => void;
} & Record<string, any>;

export function Hov({
  as: Tag = "div",
  style,
  hoverStyle,
  focusStyle,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...rest
}: HovProps) {
  const [hov, setHov] = useState(false);
  const [foc, setFoc] = useState(false);
  return (
    <Tag
      {...rest}
      style={{
        ...style,
        ...(hov ? hoverStyle : null),
        ...(foc ? focusStyle : null),
      }}
      onMouseEnter={(e: React.MouseEvent) => { setHov(true);  onMouseEnter?.(e); }}
      onMouseLeave={(e: React.MouseEvent) => { setHov(false); onMouseLeave?.(e); }}
      onFocus={(e: React.FocusEvent)      => { setFoc(true);  onFocus?.(e);      }}
      onBlur={(e: React.FocusEvent)       => { setFoc(false); onBlur?.(e);       }}
    />
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
// Reusable loading indicator. Used in buttons and anywhere else a
// loading state needs a visual signal.
export function Spinner({
  size = 14,
  color = "rgba(255,255,255,0.35)",
  topColor = "#fff",
}: {
  size?: number;
  color?: string;
  topColor?: string;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}`,
        borderTopColor: topColor,
        borderRadius: "50%",
        animation: "ib-spin 0.65s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

// ── SkeletonBlock ─────────────────────────────────────────────────────────────
// A single shimmer placeholder rectangle. Compose multiples to build
// skeleton screens that match the shape of real content.
export function SkeletonBlock({
  width,
  height,
  style,
}: {
  width?: number | string;
  height?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="ib-skeleton"
      style={{ width, height, ...style }}
    />
  );
}

// ── ErrorBanner ───────────────────────────────────────────────────────────────
// Consistent error display used in modals and forms.
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="ib-error-banner" style={{ marginBottom: 16 }}>
      <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>⚠️</span>
      <p style={{ margin: 0, fontSize: 13, color: "#c0392b", lineHeight: 1.5 }}>
        {message}
      </p>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
// Small inline label. Used on project cards, member rows, etc.
export function Badge({
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
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}

// ── FieldLabel ────────────────────────────────────────────────────────────────
// Uppercase micro-label used above form fields.
export function FieldLabel({
  children,
  required,
  optional,
  htmlFor,
}: {
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      style={{
        display: "block",
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: ".4px",
        textTransform: "uppercase",
        color: notion.textMuted,
        marginBottom: 6,
      }}
    >
      {children}
      {required && (
        <span style={{ color: notion.danger, marginLeft: 3 }}>*</span>
      )}
      {optional && (
        <span
          style={{
            fontWeight: 400,
            textTransform: "none",
            letterSpacing: 0,
            color: notion.textFaint,
            marginLeft: 5,
            fontSize: 11,
          }}
        >
          optional
        </span>
      )}
    </label>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────
export function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: lg ? 10 : 8,
        justifyContent: lg ? "center" : undefined,
        userSelect: "none",
      }}
    >
      <div
        style={{
          width: lg ? 34 : 26,
          height: lg ? 34 : 26,
          borderRadius: lg ? 8 : 6,
          background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 800,
          fontSize: lg ? 14 : 11,
          letterSpacing: "-.5px",
          boxShadow: lg
            ? "0 2px 8px rgba(37,99,235,0.35)"
            : "0 1px 4px rgba(37,99,235,0.3)",
          flexShrink: 0,
        }}
      >
        IB
      </div>
      <span
        style={{
          fontSize: lg ? 19 : 15,
          fontWeight: 700,
          letterSpacing: lg ? "-.3px" : "-.1px",
          color: notion.text,
          fontFamily: notion.font,
        }}
      >
        Info<span style={{ color: "#2563eb" }}>Board</span>
      </span>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
// Base modal shell. Handles backdrop click, Escape key, body scroll lock,
// and entrance animations. Children provide the content.
export function Modal({
  maxWidth = 440,
  onClose,
  children,
  padding = 28,
}: {
  maxWidth?: number;
  onClose: () => void;
  children: React.ReactNode;
  padding?: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Focus trap — keep focus inside the modal
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    const trap  = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", trap);
    return () => window.removeEventListener("keydown", trap);
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,15,15,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: 24,
        animation: "ib-modal-backdrop 0.18s ease forwards",
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          background: notion.bgPage,
          borderRadius: 8,
          padding,
          border: `1px solid ${notion.border}`,
          boxShadow:
            "0 8px 32px rgba(15,15,15,0.12), 0 2px 8px rgba(15,15,15,0.08), 0 0 0 1px rgba(15,15,15,0.04)",
          animation: "ib-modal-card 0.22s cubic-bezier(0.16,1,0.3,1) forwards",
          fontFamily: notion.font,
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}