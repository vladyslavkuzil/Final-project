import React, { useEffect, useState } from "react";

/**
 * Inline-style interactive element. The design prototype expresses hover/focus
 * via `style-hover`/`style-focus`; inline styles can't carry pseudo-classes, so
 * we toggle the extra style objects on hover/focus via React state. Renders any
 * tag through `as` (button, a, input, div, …).
 */
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
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      {...rest}
      style={{ ...style, ...(hov ? hoverStyle : null), ...(foc ? focusStyle : null) }}
      onMouseEnter={(e: React.MouseEvent) => {
        setHov(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e: React.MouseEvent) => {
        setHov(false);
        onMouseLeave?.(e);
      }}
      onFocus={(e: React.FocusEvent) => {
        setFoc(true);
        onFocus?.(e);
      }}
      onBlur={(e: React.FocusEvent) => {
        setFoc(false);
        onBlur?.(e);
      }}
    />
  );
}

// --- Notion-style design tokens --------------------------------------
// Shared across ProjectChatPanel.tsx and modals.tsx too. Consider moving
// this to its own theme.ts once you're happy with it, so all three files
// (and anything new) import from one place instead of redefining it.
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
  font:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"',
};

// Notion's focus ring is a plain 2px outline in its accent blue, no glow.
export const FOCUS_RING: React.CSSProperties = {
  borderColor: notion.accentBlue,
  boxShadow: `0 0 0 1px ${notion.accentBlue}`,
};

export const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: `1px solid ${notion.borderStrong}`,
  borderRadius: 4,
  fontSize: 14,
  color: notion.text,
  background: "#fff",
  outline: "none",
  fontFamily: notion.font,
};

export const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 500,
  color: notion.textMuted,
  marginBottom: 6,
};

export const ERROR_STYLE: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 13,
  color: notion.danger,
};

export function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: lg ? 10 : 9, justifyContent: lg ? "center" : undefined }}>
      {/* Kept your brand blue here on purpose — a product's mark is an
          identity choice, not a "make it Notion" choice. Notion's own
          logo is solid black/white, but that doesn't mean yours should be.
          Swap the background below if you do want to match. */}
      <div
        style={{
          width: lg ? 34 : 26,
          height: lg ? 34 : 26,
          borderRadius: lg ? 8 : 6,
          background: "#2f6fed",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontWeight: 700,
          fontSize: lg ? 15 : 12,
          letterSpacing: "-.5px",
        }}
      >
        IB
      </div>
      <span
        style={{
          fontSize: lg ? 19 : 15,
          fontWeight: 700,
          letterSpacing: lg ? "-.2px" : "-.1px",
          color: notion.text,
          fontFamily: notion.font,
        }}
      >
        Info Board
      </span>
    </div>
  );
}

export function Modal({
  maxWidth = 440,
  onClose,
  children,
}: {
  maxWidth?: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,15,15,.36)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: 24,
        animation: "ib-fade .12s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          background: notion.bgPage,
          borderRadius: 8,
          padding: 24,
          border: `1px solid ${notion.border}`,
          boxShadow: "0 4px 16px rgba(15,15,15,.12), 0 1px 3px rgba(15,15,15,.08)",
          animation: "ib-pop .16s ease",
          fontFamily: notion.font,
        }}
      >
        {children}
      </div>
    </div>
  );
}