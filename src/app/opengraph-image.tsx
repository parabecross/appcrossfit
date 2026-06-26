import { ImageResponse } from "next/og";
import { APP_CONFIG } from "@/lib/config/app-config";

export const runtime = "edge";

export const alt = `${APP_CONFIG.BRAND_NAME} — CrossFit box platform`;
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
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0a0a0a 0%, #1a0a06 45%, #0a0a0a 100%)",
          position: "relative",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -80,
            width: 420,
            height: 420,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(234,88,12,0.35) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -100,
            left: -60,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            background: "rgba(10,10,10,0.75)",
            boxShadow: "0 0 80px rgba(234,88,12,0.25)",
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: 10,
              color: "#fb923c",
              marginBottom: 16,
            }}
          >
            {APP_CONFIG.BRAND_NAME}
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: "#e5e5e5",
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Train hard. Book easy.
          </div>
          <div
            style={{
              marginTop: 20,
              fontSize: 22,
              color: "#a3a3a3",
              maxWidth: 720,
              textAlign: "center",
              lineHeight: 1.4,
            }}
          >
            Reservas · Membresías · Coaches · Progreso atleta
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
