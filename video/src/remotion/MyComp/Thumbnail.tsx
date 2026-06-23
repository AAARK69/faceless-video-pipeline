import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import { ThumbnailProps as ThumbnailPropsSchema } from "../../../types/constants";

type ThumbnailProps = z.infer<typeof ThumbnailPropsSchema>;


/**
 * Extracts the 3-4 most clickable/provocative words from a topic title.
 * Drops filler words to create a punchy thumbnail hook.
 */
function extractHookWords(topic: string): string {
  const fillerWords = new Set([
    "every", "type", "of", "the", "a", "an", "in", "on", "and", "or",
    "for", "to", "is", "are", "was", "were", "be", "been", "being",
    "that", "this", "it", "its", "with", "from", "by", "at", "as",
    "into", "all", "each", "about", "how", "what", "which", "their",
  ]);

  const words = topic.split(/\s+/).filter((w) => w.length > 0);
  const meaningful = words.filter(
    (w) => !fillerWords.has(w.toLowerCase().replace(/[^a-z]/g, ""))
  );

  // Take 3-4 most meaningful words; fall back to first 3-4 raw words
  const hook = meaningful.length >= 3 ? meaningful.slice(0, 4) : words.slice(0, 4);
  return hook.join(" ").toUpperCase();
}

/**
 * Adjusts a hex color's lightness for better contrast.
 */
function adjustColor(hex: string, factor: number): string {
  const clean = hex.replace("#", "");
  const r = Math.min(255, Math.max(0, Math.round(parseInt(clean.substring(0, 2), 16) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(clean.substring(2, 4), 16) * factor)));
  const b = Math.min(255, Math.max(0, Math.round(parseInt(clean.substring(4, 6), 16) * factor)));
  return `rgb(${r}, ${g}, ${b})`;
}

export const Thumbnail: React.FC<ThumbnailProps> = ({
  topic,
  emoji,
  accentColor,
  conceptNames,
}) => {
  // useCurrentFrame is required by Remotion even for stills
  useCurrentFrame();

  const hookText = extractHookWords(topic);
  const conceptCount = conceptNames.length;
  const badgeText = `${conceptCount} Types`;

  // Derive colors from the accent
  const glowColor = adjustColor(accentColor, 1.0);
  const accentBright = adjustColor(accentColor, 1.4);

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse at 30% 80%, ${glowColor}22 0%, transparent 50%),
          radial-gradient(ellipse at 75% 20%, #4a1a7a33 0%, transparent 50%),
          linear-gradient(135deg, #0a0e1a 0%, #121832 35%, #1a1040 65%, #0d0f1e 100%)
        `,
        fontFamily: "'Impact', 'Arial Black', 'Helvetica Neue', sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Geometric accent shapes */}
      <div
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${glowColor}18 0%, transparent 70%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -80,
          left: -40,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: `radial-gradient(circle, #6b21a818 0%, transparent 70%)`,
          filter: "blur(50px)",
        }}
      />

      {/* Diagonal accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 180,
          width: 3,
          height: "140%",
          background: `linear-gradient(180deg, transparent 0%, ${accentBright}44 40%, ${accentBright}44 60%, transparent 100%)`,
          transform: "rotate(-20deg)",
          transformOrigin: "top center",
        }}
      />

      {/* Main content container */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          padding: "40px 60px",
        }}
      >
        {/* Left side: Text content (60%) */}
        <div
          style={{
            flex: "0 0 62%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 16,
            zIndex: 2,
          }}
        >
          {/* Concept count badge with glassmorphism */}
          <div
            style={{
              alignSelf: "flex-start",
              padding: "8px 20px",
              borderRadius: 50,
              background: `linear-gradient(135deg, ${accentBright}33, ${accentBright}11)`,
              border: `1.5px solid ${accentBright}55`,
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: accentBright,
                boxShadow: `0 0 8px ${accentBright}`,
              }}
            />
            <span
              style={{
                fontSize: 22,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: 2,
                textTransform: "uppercase",
                fontFamily: "'Arial Black', 'Helvetica Neue', sans-serif",
              }}
            >
              {badgeText}
            </span>
          </div>

          {/* Main hook text — bold, high contrast */}
          <h1
            style={{
              fontSize: hookText.length > 20 ? 72 : 88,
              fontWeight: 900,
              lineHeight: 1.05,
              margin: 0,
              color: "#ffffff",
              textShadow: `
                0 0 40px ${glowColor}55,
                0 4px 12px rgba(0,0,0,0.8),
                0 0 80px ${glowColor}22
              `,
              letterSpacing: -1,
              textTransform: "uppercase",
            }}
          >
            {hookText}
          </h1>

          {/* Subtitle accent line */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 4,
                borderRadius: 2,
                background: `linear-gradient(90deg, ${accentBright}, transparent)`,
              }}
            />
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#ffffff88",
                letterSpacing: 3,
                textTransform: "uppercase",
                fontFamily: "'Helvetica Neue', sans-serif",
              }}
            >
              EXPLAINED
            </span>
          </div>
        </div>

        {/* Right side: Emoji visual anchor (38%) */}
        <div
          style={{
            flex: "0 0 38%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Glow ring behind emoji */}
          <div
            style={{
              position: "absolute",
              width: 280,
              height: 280,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${glowColor}20 0%, ${glowColor}08 50%, transparent 70%)`,
              border: `2px solid ${accentBright}22`,
            }}
          />
          {/* Secondary subtle ring */}
          <div
            style={{
              position: "absolute",
              width: 340,
              height: 340,
              borderRadius: "50%",
              border: `1px solid ${accentBright}11`,
            }}
          />
          {/* The emoji itself */}
          <span
            style={{
              fontSize: 180,
              lineHeight: 1,
              filter: `drop-shadow(0 0 30px ${glowColor}44) drop-shadow(0 8px 24px rgba(0,0,0,0.6))`,
              position: "relative",
              zIndex: 3,
            }}
          >
            {emoji}
          </span>
        </div>
      </div>

      {/* Bottom edge gradient (subtle brand strip) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 5,
          background: `linear-gradient(90deg, ${accentBright}, #6b21a8, ${accentBright})`,
          opacity: 0.7,
        }}
      />
    </AbsoluteFill>
  );
};
