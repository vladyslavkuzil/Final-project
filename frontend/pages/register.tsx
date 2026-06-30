import { useRouter } from "next/router";
import { FOCUS_RING, Hov, INPUT_STYLE, LABEL_STYLE, Logo } from "../components/infoboard/ui";

export default function Register() {
  const router = useRouter();

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
            <h1 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 600, letterSpacing: "-.3px" }}>
              Create your account
            </h1>
            <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "#8b8a83" }}>Start managing projects in minutes</p>
            <label style={LABEL_STYLE}>Email</label>
            <Hov
              as="input"
              type="email"
              placeholder="you@example.com"
              style={{ ...INPUT_STYLE, marginBottom: 16 }}
              focusStyle={FOCUS_RING}
            />
            <label style={LABEL_STYLE}>Password</label>
            <Hov
              as="input"
              type="password"
              placeholder="••••••••"
              style={{ ...INPUT_STYLE, marginBottom: 16 }}
              focusStyle={FOCUS_RING}
            />
            <label style={LABEL_STYLE}>Confirm password</label>
            <Hov
              as="input"
              type="password"
              placeholder="••••••••"
              style={{ ...INPUT_STYLE, marginBottom: 22 }}
              focusStyle={FOCUS_RING}
            />
            <Hov
              as="button"
              onClick={() => router.push("/projects")}
              style={{
                width: "100%",
                padding: 10,
                background: "#2f6fed",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
              hoverStyle={{ background: "#2560d8" }}
            >
              Create Account
            </Hov>
          </div>
          <p style={{ textAlign: "center", margin: "18px 0 0", fontSize: 13.5, color: "#8b8a83" }}>
            Already have an account?{" "}
            <a
              onClick={() => router.push("/login")}
              style={{ color: "#2f6fed", fontWeight: 500, cursor: "pointer", textDecoration: "none" }}
            >
              Log In
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
