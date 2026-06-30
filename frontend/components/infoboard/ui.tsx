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

export const FOCUS_RING: React.CSSProperties = {
  borderColor: "#2f6fed",
  boxShadow: "0 0 0 3px rgba(47,111,237,.12)",
};

export const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #e3e3df",
  borderRadius: 8,
  fontSize: 14,
  color: "#37352f",
  background: "#fff",
  outline: "none",
};

export const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 500,
  color: "#5c5b57",
  marginBottom: 6,
};

export function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: lg ? 10 : 9, justifyContent: lg ? "center" : undefined }}>
      <div
        style={{
          width: lg ? 34 : 26,
          height: lg ? 34 : 26,
          borderRadius: lg ? 9 : 7,
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
      <span style={{ fontSize: lg ? 19 : 15, fontWeight: 600, letterSpacing: lg ? "-.3px" : "-.2px" }}>
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
        background: "rgba(15,15,15,.42)",
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
          background: "#fff",
          borderRadius: 14,
          padding: 24,
          boxShadow: "0 12px 40px rgba(15,15,15,.18)",
          animation: "ib-pop .16s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
