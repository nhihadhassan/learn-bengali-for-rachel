import { ImageResponse } from "next/og";

export const alt = "Learning for Rachel — language and history learning";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#151225",
          color: "#f8fafc",
          fontFamily: "Arial, sans-serif",
          padding: "72px 78px",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 700,
            height: 700,
            left: -180,
            top: -270,
            borderRadius: "50%",
            background: "rgba(124, 58, 237, 0.34)",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 560,
            height: 560,
            right: -120,
            bottom: -250,
            borderRadius: "50%",
            background: "rgba(6, 182, 212, 0.22)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 58,
                height: 58,
                borderRadius: 20,
                background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  position: "relative",
                  width: 30,
                  height: 30,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 9,
                    top: -2,
                    width: 12,
                    height: 34,
                    borderRadius: 8,
                    background: "#f8fafc",
                    transform: "rotate(45deg)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 9,
                    top: -2,
                    width: 12,
                    height: 34,
                    borderRadius: 8,
                    background: "#f8fafc",
                    transform: "rotate(-45deg)",
                  }}
                />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 24, fontWeight: 800 }}>
              <span>Learning</span>
              <span style={{ color: "#a5b4fc", fontSize: 18 }}>for Rachel</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginTop: 76 }}>
            <span style={{ color: "#c4b5fd", fontSize: 20, letterSpacing: 4, fontWeight: 700 }}>
              LEARN A LITTLE. REMEMBER MORE.
            </span>
            <span style={{ marginTop: 18, fontSize: 56, lineHeight: 1.08, fontWeight: 800 }}>
              Language and history,
            </span>
            <span style={{ fontSize: 56, lineHeight: 1.08, fontWeight: 800 }}>
              one step at a time.
            </span>
            <span style={{ marginTop: 26, color: "#cbd5e1", fontSize: 24 }}>
              Bengali · Spanish · Malayalam · History
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 90,
            top: 150,
            width: 270,
            height: 270,
            borderRadius: 48,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            transform: "rotate(7deg)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 22, margin: "48px 42px" }}>
            {["Start", "Practice", "Remember"].map((label, index) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: index === 2 ? "#67e8f9" : "#a78bfa",
                    boxShadow: "0 0 0 8px rgba(167,139,250,0.12)",
                  }}
                />
                <span style={{ color: "#e2e8f0", fontSize: 22, fontWeight: 700 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
