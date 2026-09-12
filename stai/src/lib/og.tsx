import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

const NAVY = "#0E1726";
const NAVY_DEEP = "#0A111D";
const CREAM = "#F5F2EC";
const CREAM_DIM = "#A9A498";
const GOLD = "#C9A84C";

/**
 * Share cards, rendered on our own server (next/og bundles its own font —
 * nothing is fetched at runtime, which keeps the firewall guarantee intact).
 * Composition mirrors the site: hairline frame, mono labels, one heavy
 * headline, gold used only when the piece is STAI+.
 */
export function ogCard(opts: {
  eyebrow: string;
  title: string;
  meta?: string;
  premium?: boolean;
}) {
  const { eyebrow, title, meta, premium } = opts;
  const size = title.length > 92 ? 58 : title.length > 60 ? 70 : 84;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: NAVY,
          padding: 56,
          position: "relative",
        }}
      >
        {/* hairline frame */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 28,
            right: 28,
            bottom: 28,
            border: `1px solid ${premium ? "rgba(201,168,76,0.4)" : "rgba(237,234,227,0.18)"}`,
            display: "flex",
          }}
        />
        {/* masthead */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 42,
                height: 42,
                border: `2px solid ${CREAM}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: CREAM,
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              S
            </div>
            <div
              style={{
                marginLeft: 16,
                color: CREAM,
                fontSize: 30,
                letterSpacing: 2,
                fontWeight: 700,
                display: "flex",
              }}
            >
              STAI
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {premium && (
              <div
                style={{
                  display: "flex",
                  color: GOLD,
                  fontSize: 16,
                  letterSpacing: 3,
                  border: `1px solid rgba(201,168,76,0.5)`,
                  padding: "6px 12px",
                  marginRight: 16,
                }}
              >
                STAI+
              </div>
            )}
            <div style={{ display: "flex", color: CREAM_DIM, fontSize: 17, letterSpacing: 4 }}>
              STAI.AI
            </div>
          </div>
        </div>

        {/* eyebrow + headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            paddingTop: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              color: premium ? GOLD : CREAM_DIM,
              fontSize: 18,
              letterSpacing: 5,
              textTransform: "uppercase",
              marginBottom: 26,
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              color: CREAM,
              fontSize: size,
              lineHeight: 1.04,
              letterSpacing: -1.5,
              textTransform: "uppercase",
              fontWeight: 700,
              maxWidth: 1000,
            }}
          >
            {title}
          </div>
        </div>

        {/* footer rule + meta */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              height: 1,
              backgroundColor: "rgba(237,234,227,0.18)",
              marginBottom: 20,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", color: CREAM_DIM, fontSize: 20, letterSpacing: 1 }}>
              {meta ?? "Signal & training for audit intelligence"}
            </div>
            <div style={{ display: "flex", color: CREAM_DIM, fontSize: 18, letterSpacing: 2 }}>
              EU AI ACT · 02 AUG 2026
            </div>
          </div>
        </div>

        {/* corner tick — the terminal signature */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 28,
            width: 14,
            height: 14,
            borderTop: `3px solid ${premium ? GOLD : CREAM}`,
            borderLeft: `3px solid ${premium ? GOLD : CREAM}`,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 28,
            right: 28,
            width: 14,
            height: 14,
            borderBottom: `3px solid ${premium ? GOLD : CREAM}`,
            borderRight: `3px solid ${premium ? GOLD : CREAM}`,
            display: "flex",
          }}
        />
        <div style={{ position: "absolute", inset: 0, backgroundColor: NAVY_DEEP, opacity: 0, display: "flex" }} />
      </div>
    ),
    { ...OG_SIZE }
  );
}
