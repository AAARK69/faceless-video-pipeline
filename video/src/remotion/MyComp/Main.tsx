import React from "react";
import {
  AbsoluteFill,
  Audio,
  useCurrentFrame,
  useVideoConfig,
  getInputProps,
  staticFile,
  interpolate,
  Sequence,
  Easing
} from "remotion";
// Removed Google Font loading due to sandbox network restrictions
const fontFamily = '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif';

interface Word {
  word: string;
  start: number;
  end: number;
}

interface Scene {
  text: string;
  sketch: string;
  start: number;
  end: number;
}

interface Concept {
  name: string;
  emoji: string;
  color: string;
  start: number;
  end: number;
  description: string;
  scenes?: Scene[];
}

interface MainProps {
  topic: string;
  items: Concept[];
  audioUrl: string;
  words: Word[];
  bgmUrl?: string;
  sfxUrl?: string;
}

// ---------------------------------------------------------
// Visual State Types
// ---------------------------------------------------------
type VisualState =
  | { type: "gallery"; highlightIndex: number }
  | { type: "zoom"; conceptIndex: number; progress: number }
  | { type: "detail"; conceptIndex: number };

// Transition timing constants (seconds)
const GALLERY_HOLD = 0.7;
const ZOOM_DURATION = 0.5;
const TRANSITION_TOTAL = GALLERY_HOLD + ZOOM_DURATION;

// ---------------------------------------------------------
// Presenter Stickman Component (Light theme / Hand-drawn style)
// ---------------------------------------------------------
const Stickman: React.FC<{
  frame: number;
  timeSec: number;
  words: Word[];
  items: Concept[];
  poseIndex: number;
  activeColor: string;
}> = ({
  frame,
  timeSec,
  words,
  items,
  poseIndex,
  activeColor,
}) => {
  const headBob = Math.sin(frame / 6) * 1.5;
  const sway = Math.sin(frame / 12) * 1.2;
  const strokeProps = {
    stroke: "#1e293b",
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  // Organic eye blinking
  const isBlinking = (frame % 90) < 4;
  const eyes = isBlinking ? (
    <g key="eyes-blink">
      <line x1={44 + sway * 0.5} y1={30 + headBob} x2={48 + sway * 0.5} y2={30 + headBob} stroke="#1e293b" strokeWidth={2.5} strokeLinecap="round" />
      <line x1={52 + sway * 0.5} y1={30 + headBob} x2={56 + sway * 0.5} y2={30 + headBob} stroke="#1e293b" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  ) : (
    <g key="eyes-open">
      <circle cx={46 + sway * 0.5} cy={30 + headBob} r={1.8} fill="#1e293b" />
      <circle cx={54 + sway * 0.5} cy={30 + headBob} r={1.8} fill="#1e293b" />
    </g>
  );

  // Dynamic speaking mouth synchronized with active word duration
  const isTalking = words.some(w => timeSec >= w.start && timeSec <= w.end);
  const talkAmp = isTalking ? Math.max(0.5, Math.abs(Math.sin(frame / 1.5)) * 3) : 0;
  const mouth = (
    <path
      d={`M ${44 + sway * 0.5} ${36 + headBob} Q ${50 + sway * 0.5} ${39 + headBob + talkAmp}, ${56 + sway * 0.5} ${36 + headBob}`}
      stroke="#1e293b"
      strokeWidth={2.5}
      strokeLinecap="round"
      fill="none"
    />
  );

  const renderPose = (pIndex: number, opacity: number) => {
    const p = pIndex < 0 ? 0 : pIndex % 6;
    const wave = Math.sin(frame / 3.5) * 4;
    const glow = Math.sin(frame / 5) > 0;

    switch (p) {
      case 0: // Welcoming / Explaining (both arms open wide)
        return (
          <g key={`pose-wel-${pIndex}`} style={{ opacity }}>
            <path d={`M 50 48 Q 32 50, 24 42`} {...strokeProps} />
            <path d={`M 50 48 Q 68 50, 76 42`} {...strokeProps} />
          </g>
        );
      case 1: // Pointing Left (pointing to the gallery grid or details)
        return (
          <g key={`pose-ptr-${pIndex}`} style={{ opacity }}>
            <path d={`M 50 48 L ${22 + sway} 36`} {...strokeProps} />
            <path d={`M ${22 + sway} 36 L ${28 + sway} 30`} {...strokeProps} />
            <path d={`M 50 48 Q 62 60, 60 70`} {...strokeProps} />
            <circle cx={14 + sway} cy={30} r={4.5} fill={activeColor} opacity={Math.sin(frame / 4) > 0 ? 1 : 0.3} />
          </g>
        );
      case 2: // Celebrating (raising hands in the air)
        return (
          <g key={`pose-cel-${pIndex}`} style={{ opacity }}>
            <path d={`M 50 48 Q 36 32, 26 ${20 + wave}`} {...strokeProps} />
            <path d={`M 50 48 Q 64 32, 74 ${20 - wave}`} {...strokeProps} />
          </g>
        );
      case 3: // Thinking (question mark and hand on chin)
        return (
          <g key={`pose-thk-${pIndex}`} style={{ opacity }}>
            <path d={`M 50 48 Q 35 55, 38 68`} {...strokeProps} />
            <path d={`M 50 48 Q 58 46, 52 38`} {...strokeProps} />
            <text x={68 + sway * 0.5} y={22 + headBob} fontSize="20" fontWeight="bold" fontFamily="monospace" fill="#1e293b" opacity={0.8}>?</text>
          </g>
        );
      case 4: // Eureka (lightbulb above head)
        return (
          <g key={`pose-eur-${pIndex}`} style={{ opacity }}>
            <path d={`M 50 48 Q 35 60, 38 72`} {...strokeProps} />
            <path d={`M 50 48 L ${50 + sway} 18`} {...strokeProps} />
            <text x={50 + sway} y={8 + headBob} fontSize="22" opacity={glow ? 1 : 0.4} filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))">💡</text>
          </g>
        );
      case 5: // Shrugging
      default:
        return (
          <g key={`pose-shr-${pIndex}`} style={{ opacity }}>
            <path d={`M 50 48 Q 38 42, 28 36`} {...strokeProps} />
            <path d={`M 50 48 Q 62 42, 72 36`} {...strokeProps} />
          </g>
        );
    }
  };

  // Determine if we are within the first 15 frames of a concept's start time
  let currentConceptStart = 0;
  if (poseIndex >= 0 && items[poseIndex]) {
    currentConceptStart = Math.floor(items[poseIndex].start * 30);
  }
  const framesSinceTransition = frame - currentConceptStart;
  const isTransitioning = poseIndex > 0 && framesSinceTransition >= 0 && framesSinceTransition < 15;

  const getPoseElements = () => {
    if (isTransitioning) {
      const blend = interpolate(framesSinceTransition, [0, 15], [0, 1], {
        extrapolateRight: 'clamp',
        extrapolateLeft: 'clamp'
      });
      return (
        <>
          {renderPose(poseIndex - 1, 1 - blend)}
          {renderPose(poseIndex, blend)}
        </>
      );
    }
    return renderPose(poseIndex, 1);
  };

  return (
    <svg viewBox="0 0 100 120" style={{ width: 220, height: 260 }}>
      {/* Head */}
      <circle cx={50 + sway * 0.5} cy={32 + headBob} r={12} {...strokeProps} fill="#ffffff" />
      {/* Eyes & Mouth */}
      {eyes}
      {mouth}
      
      {/* Torso */}
      <path d={`M ${50 + sway * 0.5} ${44 + headBob} L ${50 + sway} 80`} {...strokeProps} />

      {/* Dynamic Arms based on Pose */}
      {getPoseElements()}

      {/* Legs */}
      <path d={`M ${50 + sway} 80 L 35 115`} {...strokeProps} />
      <path d={`M ${50 + sway} 80 L 65 115`} {...strokeProps} />
    </svg>
  );
};

// ---------------------------------------------------------
// Draw-In SVG Ring (badge highlight animation)
// ---------------------------------------------------------
const DrawInRing: React.FC<{ frame: number; startFrame: number; color: string; size: number }> = ({ frame, startFrame, color, size }) => {
  const r = size / 2 - 4;
  const circ = 2 * Math.PI * r;
  const progress = interpolate(frame - startFrame, [0, 22], [0, 1], { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' });
  const dashoffset = circ * (1 - progress);
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: size, height: size, overflow: 'visible' }}
      viewBox={`0 0 ${size} ${size}`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={circ}
        strokeDashoffset={dashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
};

// ---------------------------------------------------------
// SVG Badge Icon Renderer (for gallery badges AND detail view)
// ---------------------------------------------------------
const BadgeIcon: React.FC<{ name: string; emoji: string; size?: number }> = ({
  name,
  emoji,
  size = 100,
}) => {
  const n = name.toLowerCase().replace(/[^a-z]/g, "");
  const s = {
    stroke: "#000",
    strokeWidth: 5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  const svgStyle = { width: size, height: size };

  switch (n) {
    case "nosoapradio":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <rect x="15" y="30" width="70" height="50" rx="10" fill="#fdba74" stroke="#000" strokeWidth="5" />
          <line x1="30" y1="30" x2="15" y2="12" {...s} />
          <circle cx="15" cy="12" r="3" fill="#000" />
          <circle cx="35" cy="55" r="12" fill="#fed7aa" stroke="#000" strokeWidth="4" />
          <circle cx="35" cy="55" r="4" fill="#000" />
          <circle cx="68" cy="48" r="6" fill="#000" />
          <circle cx="68" cy="62" r="6" fill="#000" />
        </svg>
      );
    case "antijoke":
    case "antihumor":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="50" cy="50" r="32" {...s} strokeWidth="7" />
          <line x1="28" y1="28" x2="72" y2="72" {...s} strokeWidth="7" />
        </svg>
      );
    case "sarcasm":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="50" cy="50" r="32" fill="#86efac" stroke="#000" strokeWidth="5" />
          <path d="M 33 42 C 33 35, 43 35, 43 42" {...s} strokeWidth="4" />
          <circle cx="38" cy="36" r="3.5" fill="#000" />
          <path d="M 57 42 C 57 35, 67 35, 67 42" {...s} strokeWidth="4" />
          <circle cx="62" cy="36" r="3.5" fill="#000" />
          <path d="M 35 62 Q 50 52, 65 62" {...s} />
        </svg>
      );
    case "slapstick":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <rect x="35" y="32" width="30" height="46" rx="4" fill="#fca5a5" stroke="#000" strokeWidth="5" />
          <line x1="50" y1="32" x2="50" y2="18" {...s} />
          <path d="M 50 14 L 50 8" {...s} strokeWidth="4" />
          <path d="M 46 16 L 40 12" {...s} strokeWidth="4" />
          <path d="M 54 16 L 60 12" {...s} strokeWidth="4" />
        </svg>
      );
    case "whitehumor":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="50" cy="54" r="30" fill="#93c5fd" stroke="#000" strokeWidth="5" />
          <ellipse cx="50" cy="18" rx="20" ry="7" fill="#fef08a" stroke="#000" strokeWidth="4" />
          <path d="M 38 48 Q 43 54, 48 48" {...s} strokeWidth="4" />
          <path d="M 52 48 Q 57 54, 62 48" {...s} strokeWidth="4" />
          <path d="M 42 66 Q 50 74, 58 66" {...s} />
        </svg>
      );
    case "dryhumor":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="50" cy="50" r="32" fill="#c084fc" stroke="#000" strokeWidth="5" />
          <line x1="33" y1="42" x2="45" y2="42" {...s} />
          <line x1="55" y1="42" x2="67" y2="42" {...s} />
          <line x1="33" y1="64" x2="67" y2="64" {...s} />
        </svg>
      );
    case "blackhumor":
    case "darkhumor":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="50" cy="50" r="32" fill="#f0abfc" stroke="#000" strokeWidth="5" />
          <path d="M 35 48 C 35 34, 65 34, 65 48 C 65 58, 58 58, 58 66 L 42 66 C 42 58, 35 58, 35 48 Z" fill="#fff" stroke="#000" strokeWidth="4" />
          <circle cx="44" cy="46" r="5" fill="#000" />
          <circle cx="56" cy="46" r="5" fill="#000" />
        </svg>
      );
    case "satire":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M 32 30 H 48 V 46 L 40 68 L 36 68 Q 32 50, 32 46 Z" fill="#fca5a5" stroke="#000" strokeWidth="5" />
          <rect x="48" y="24" width="22" height="28" rx="4" fill="#ef4444" stroke="#000" strokeWidth="5" />
          <line x1="38" y1="30" x2="38" y2="46" {...s} strokeWidth="4" />
        </svg>
      );
    case "surrealhumor":
    case "surreal":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M 25 30 C 25 20, 75 20, 75 30 C 75 55, 60 55, 60 75 C 60 90, 35 85, 35 70 C 35 55, 25 55, 25 30 Z" fill="#fde047" stroke="#000" strokeWidth="5" />
          <path d="M 50 40 Q 55 52, 45 62" {...s} strokeWidth="4" />
          <circle cx="50" cy="40" r="3" fill="#000" />
        </svg>
      );
    case "greenhumor":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="36" cy="62" r="14" {...s} />
          <line x1="47" y1="51" x2="62" y2="36" {...s} strokeWidth="5" />
          <circle cx="64" cy="38" r="14" {...s} />
          <line x1="30" y1="58" x2="42" y2="70" {...s} strokeWidth="5" />
        </svg>
      );
    case "grotesque":
    case "grotesquehumor":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M 20 40 C 20 20, 80 15, 80 40 Q 85 70, 70 75 Q 50 90, 30 75 Q 15 70, 20 40 Z" fill="#86efac" stroke="#000" strokeWidth="5" />
          <circle cx="38" cy="38" r="10" fill="#fff" stroke="#000" strokeWidth="3" />
          <circle cx="38" cy="38" r="3" fill="#000" />
          <circle cx="64" cy="34" r="4" fill="#000" />
          <path d="M 32 58 Q 50 72, 68 58 Z" fill="#ef4444" stroke="#000" strokeWidth="3" />
        </svg>
      );
    case "reaffautod":
    case "reaffautodestructive":
    case "reaffirmingautodestructive":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <rect x="15" y="38" width="70" height="24" rx="6" transform="rotate(45 50 50)" fill="#fed7aa" stroke="#000" strokeWidth="5" />
          <rect x="15" y="38" width="70" height="24" rx="6" transform="rotate(-45 50 50)" fill="#fed7aa" stroke="#000" strokeWidth="5" />
          <rect x="40" y="40" width="20" height="20" fill="#ffedd5" stroke="#000" strokeWidth="3" />
        </svg>
      );
    case "observational":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M 15 50 Q 50 20, 85 50 Q 50 80, 15 50 Z" fill="#fff" stroke="#000" strokeWidth="5" />
          <circle cx="50" cy="50" r="18" fill="#60a5fa" stroke="#000" strokeWidth="3" />
          <circle cx="50" cy="50" r="8" fill="#000" />
          <circle cx="45" cy="45" r="3" fill="#fff" />
        </svg>
      );
    case "insultcomedy":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M 15 45 C 15 30, 85 30, 85 45 C 85 60, 65 60, 55 60 L 40 75 L 42 60 C 20 60, 15 55, 15 45 Z" fill="#f472b6" stroke="#000" strokeWidth="5" />
          <text x="50" y="52" textAnchor="middle" fontSize="22" fontWeight="bold" fontFamily="Impact, Arial Black" fill="#000">#$!</text>
        </svg>
      );
    // --- Manipulation Tactics ---
    case "gaslighting":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M 45 25 C 45 15, 55 15, 55 25 L 55 55 L 45 55 Z" fill="#fde047" stroke="#000" strokeWidth="4" />
          <path d="M 42 55 L 42 70 Q 50 80, 58 70 L 58 55 Z" fill="#e2e8f0" stroke="#000" strokeWidth="4" />
          <path d="M 50 18 Q 55 10, 52 5" fill="none" stroke="#f97316" strokeWidth="3" />
          <path d="M 48 22 Q 42 12, 46 6" fill="none" stroke="#f97316" strokeWidth="3" />
        </svg>
      );
    case "guiltripping":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="50" cy="40" r="25" fill="#93c5fd" stroke="#000" strokeWidth="5" />
          <circle cx="42" cy="35" r="3" fill="#000" />
          <circle cx="58" cy="35" r="3" fill="#000" />
          <path d="M 42 52 Q 50 45, 58 52" {...s} />
          <path d="M 38 58 Q 50 78, 62 58" fill="#60a5fa" stroke="#000" strokeWidth="4" />
        </svg>
      );
    case "silenttreatment":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="50" cy="45" r="28" fill="#d1d5db" stroke="#000" strokeWidth="5" />
          <line x1="37" y1="38" x2="45" y2="38" {...s} />
          <line x1="55" y1="38" x2="63" y2="38" {...s} />
          <line x1="38" y1="56" x2="62" y2="56" {...s} strokeWidth="6" />
          <line x1="33" y1="53" x2="33" y2="59" {...s} strokeWidth="4" stroke="#ef4444" />
          <line x1="30" y1="56" x2="36" y2="56" {...s} strokeWidth="4" stroke="#ef4444" />
        </svg>
      );
    case "lovebombing":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <path d="M 50 75 L 20 45 C 15 30, 35 20, 50 38 C 65 20, 85 30, 80 45 Z" fill="#f472b6" stroke="#000" strokeWidth="5" />
          <path d="M 30 20 L 35 28" {...s} strokeWidth="3" stroke="#fbbf24" />
          <path d="M 70 20 L 65 28" {...s} strokeWidth="3" stroke="#fbbf24" />
          <path d="M 50 12 L 50 20" {...s} strokeWidth="3" stroke="#fbbf24" />
          <circle cx="15" cy="60" r="4" fill="#f472b6" />
          <circle cx="85" cy="55" r="3" fill="#f472b6" />
          <circle cx="75" cy="70" r="5" fill="#f472b6" />
        </svg>
      );
    case "playingvictim":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="50" cy="40" r="25" fill="#fde68a" stroke="#000" strokeWidth="5" />
          <path d="M 38 32 Q 42 40, 46 32" {...s} strokeWidth="4" />
          <path d="M 54 32 Q 58 40, 62 32" {...s} strokeWidth="4" />
          <path d="M 40 55 Q 50 48, 60 55" {...s} />
          <path d="M 48 60 L 50 75" {...s} strokeWidth="3" fill="#60a5fa" />
          <circle cx="50" cy="78" r="4" fill="#60a5fa" />
        </svg>
      );
    case "movinggoalposts":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <line x1="70" y1="20" x2="70" y2="80" {...s} strokeWidth="6" />
          <line x1="60" y1="20" x2="80" y2="20" {...s} strokeWidth="4" />
          <line x1="60" y1="80" x2="80" y2="80" {...s} strokeWidth="4" />
          <path d="M 25 50 L 55 50" {...s} strokeWidth="5" strokeDasharray="8,6" />
          <circle cx="22" cy="50" r="8" fill="#86efac" stroke="#000" strokeWidth="4" />
          <path d="M 75 40 L 85 50 L 75 60" {...s} strokeWidth="4" stroke="#ef4444" />
        </svg>
      );
    case "triangulation":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <polygon points="50,15 15,80 85,80" fill="none" stroke="#8b5cf6" strokeWidth="6" />
          <circle cx="50" cy="22" r="8" fill="#c084fc" stroke="#000" strokeWidth="4" />
          <circle cx="22" cy="75" r="8" fill="#c084fc" stroke="#000" strokeWidth="4" />
          <circle cx="78" cy="75" r="8" fill="#c084fc" stroke="#000" strokeWidth="4" />
        </svg>
      );
    case "projection":
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <rect x="20" y="20" width="60" height="60" rx="8" fill="#bfdbfe" stroke="#000" strokeWidth="5" />
          <circle cx="50" cy="50" r="15" fill="#fff" stroke="#000" strokeWidth="4" />
          <circle cx="50" cy="50" r="5" fill="#000" />
          <path d="M 50 35 L 50 28" {...s} strokeWidth="3" />
          <path d="M 65 50 L 72 50" {...s} strokeWidth="3" />
          <path d="M 35 50 L 28 50" {...s} strokeWidth="3" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 100 100" style={svgStyle}>
          <circle cx="50" cy="50" r="30" fill="#e2e8f0" stroke="#000" strokeWidth="5" />
          <text x="50" y="58" textAnchor="middle" fontSize="24" fontWeight="bold" fill="#000">{emoji}</text>
        </svg>
      );
  }
};

// ---------------------------------------------------------
// Main Remotion Video Layout Component
// ---------------------------------------------------------
export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeSec = frame / fps;

  const props = (getInputProps() as unknown) as MainProps;
  const topic = props.topic || "Every Type of Humor Explained";
  const items = props.items || [];
  const audioUrl = props.audioUrl || "";
  const words = props.words || [];
  const bgmUrl = props.bgmUrl === undefined ? "/bgm.mp3" : props.bgmUrl;
  const sfxUrl = props.sfxUrl === undefined ? "/click.mp3" : props.sfxUrl;

  // ---------------------------------------------------------
  // Determine Visual State: gallery | zoom | detail
  // ---------------------------------------------------------
  const getVisualState = (): VisualState => {
    if (items.length === 0) return { type: "gallery", highlightIndex: -1 };

    // Intro: before first concept starts
    if (timeSec < items[0].start) {
      return { type: "gallery", highlightIndex: -1 };
    }

    // Outro: after last concept ends
    if (timeSec > items[items.length - 1].end) {
      return { type: "gallery", highlightIndex: -1 };
    }

    // Check each concept's time range
    for (let i = 0; i < items.length; i++) {
      if (timeSec >= items[i].start && timeSec <= items[i].end) {
        const elapsed = timeSec - items[i].start;

        if (elapsed < GALLERY_HOLD) {
          // Show gallery with this badge highlighted
          return { type: "gallery", highlightIndex: i };
        } else if (elapsed < TRANSITION_TOTAL) {
          // Zoom transition from gallery into detail
          const progress = (elapsed - GALLERY_HOLD) / ZOOM_DURATION;
          return { type: "zoom", conceptIndex: i, progress };
        } else {
          // Full detail view
          return { type: "detail", conceptIndex: i };
        }
      }
    }

    // In a gap between concepts — show gallery, highlight the next one
    for (let i = 0; i < items.length - 1; i++) {
      if (timeSec > items[i].end && timeSec < items[i + 1].start) {
        return { type: "gallery", highlightIndex: i + 1 };
      }
    }

    return { type: "gallery", highlightIndex: -1 };
  };

  const visualState = getVisualState();

  // ---------------------------------------------------------
  // Active concept for detail / zoom views
  // ---------------------------------------------------------
  const activeConceptIndex =
    visualState.type === "zoom"
      ? visualState.conceptIndex
      : visualState.type === "detail"
      ? visualState.conceptIndex
      : -1;
  const activeItem = activeConceptIndex >= 0 ? items[activeConceptIndex] : null;

  // ---------------------------------------------------------
  // Subtitle Chunking
  // ---------------------------------------------------------
  const chunks = React.useMemo(() => {
    const list: Word[][] = [];
    let currentChunk: Word[] = [];
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      currentChunk.push(w);
      const isLast = i === words.length - 1;
      const next = words[i + 1];
      const hasPunc = /[.!?]/.test(w.word);
      const hasGap = next ? next.start - w.end > 0.4 : false;
      const tooLong = currentChunk.length >= 6;
      if (isLast || hasPunc || hasGap || tooLong) {
        list.push(currentChunk);
        currentChunk = [];
      }
    }
    return list;
  }, [words]);

  const activeChunkIndex = React.useMemo(() => {
    if (chunks.length === 0) return -1;
    let idx = chunks.findIndex((c) => {
      const s = c[0].start;
      const e = c[c.length - 1].end;
      return timeSec >= s && timeSec <= e;
    });
    if (idx !== -1) return idx;
    idx = chunks.findIndex((c) => c[0].start > timeSec);
    if (idx !== -1) {
      if (idx === 0) return 0;
      const prev = chunks[idx - 1];
      const prevEnd = prev[prev.length - 1].end;
      return timeSec - prevEnd < chunks[idx][0].start - timeSec ? idx - 1 : idx;
    }
    return chunks.length - 1;
  }, [chunks, timeSec]);

  const activeWords = activeChunkIndex !== -1 ? chunks[activeChunkIndex] : [];

  // ---------------------------------------------------------
  // Layer Opacity & Scale Calculations (Eased for premium feel)
  // ---------------------------------------------------------
  const galleryOpacity =
    visualState.type === "gallery"
      ? 1
      : visualState.type === "zoom"
      ? interpolate(visualState.progress, [0, 1], [1, 0], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
          easing: Easing.out(Easing.quad)
        })
      : 0;

  const galleryScale =
    visualState.type === "zoom"
      ? interpolate(visualState.progress, [0, 1], [1, 1.15], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
          easing: Easing.out(Easing.cubic)
        })
      : 1;

  const detailOpacity =
    visualState.type === "detail"
      ? 1
      : visualState.type === "zoom"
      ? interpolate(visualState.progress, [0, 1], [0, 1], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
          easing: Easing.out(Easing.quad)
        })
      : 0;

  const detailBadgeScale =
    visualState.type === "zoom"
      ? interpolate(visualState.progress, [0, 1], [0.4, 1], {
          extrapolateRight: "clamp",
          extrapolateLeft: "clamp",
          easing: Easing.out(Easing.cubic)
        })
      : 1;

  // ---------------------------------------------------------
  // Pulsing highlight animation for gallery badges
  // ---------------------------------------------------------
  const pulseScale = interpolate(
    Math.sin((frame / 10) * Math.PI),
    [-1, 1],
    [1.0, 1.12]
  );
  // Determine grid columns based on item count
  const gridCols = items.length <= 12 ? 4 : 5;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#ffffff",
        backgroundImage: "radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)",
        backgroundSize: "36px 36px",
        fontFamily,
        color: "#1e293b",
        overflow: "hidden",
      }}
    >
      {/* ================================================================ */}
      {/* GALLERY LAYER */}
      {/* ================================================================ */}
      {galleryOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "50px 60px",
            opacity: galleryOpacity,
            transform: `scale(${galleryScale})`,
            transformOrigin: "center center",
            userSelect: "none",
          }}
        >
          {/* Title */}
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontSize: 52,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 2,
                margin: 0,
                color: "#0f172a",
              }}
            >
              {topic}
            </h1>
          </div>

          {/* Main content row with Grid on Left and Stickman on Right */}
          {(() => {
            const highlightIndex = visualState.type === "gallery" ? visualState.highlightIndex : -1;
            return (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  width: "100%",
                  flexGrow: 1,
                  justifyContent: "space-around",
                  alignItems: "center",
                  margin: "auto 0",
                }}
              >
            {/* Left: Badge Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                gap: "25px 35px",
                maxWidth: "75%",
                justifyItems: "center",
                alignItems: "center",
              }}
            >
              {items.map((item, index) => {
                const isHighlighted =
                  visualState.type === "gallery" &&
                  visualState.highlightIndex === index;
                const isCompleted = timeSec > item.end;

                return (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      transform: isHighlighted
                        ? `scale(${pulseScale})`
                        : "scale(1)",
                      opacity: isCompleted ? 0.35 : 1,
                      transition: "opacity 0.3s",
                    }}
                  >
                    {/* Colored Circle Badge */}
                    <div
                      style={{
                        width: 130,
                        height: 130,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: item.color,
                        border: isHighlighted
                          ? `6px solid #1e293b`
                          : `6px solid ${item.color}`,
                        boxShadow: isHighlighted
                          ? `0 0 30px ${item.color}bf, 0 8px 24px rgba(0,0,0,0.12)`
                          : "0 4px 12px rgba(0,0,0,0.06)",
                        position: "relative",
                      }}
                    >
                      <BadgeIcon name={item.name} emoji={item.emoji} size={80} />

                      {/* Draw-In Ring for highlighted badge */}
                      {isHighlighted && (
                        <DrawInRing
                          frame={frame}
                          startFrame={
                            visualState.type === 'gallery' && visualState.highlightIndex === index
                              ? Math.floor((items[index]?.start || 0) * fps)
                              : 0
                          }
                          color="#ffffff"
                          size={130}
                        />
                      )}

                      {/* Red X for completed badges */}
                      {isCompleted && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              width: "115%",
                              height: 8,
                              backgroundColor: "#dc2626",
                              borderRadius: 4,
                              transform: "rotate(45deg)",
                              opacity: 0.9,
                            }}
                          />
                          <div
                            style={{
                              position: "absolute",
                              width: "115%",
                              height: 8,
                              backgroundColor: "#dc2626",
                              borderRadius: 4,
                              transform: "rotate(-45deg)",
                              opacity: 0.9,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Label */}
                    <span
                      style={{
                        marginTop: 10,
                        fontSize: 18,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        textAlign: "center",
                        maxWidth: 150,
                        color: isHighlighted ? "#0f172a" : "#64748b",
                        letterSpacing: 1,
                      }}
                    >
                      {item.name}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right: Stickman Presenter in Gallery View */}
            <div
              style={{
                width: "250px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                transform: "translateY(-10px)",
              }}
            >
              <Stickman
                frame={frame}
                timeSec={timeSec}
                words={activeWords}
                items={items}
                poseIndex={highlightIndex === -1 ? 0 : 1}
                activeColor={highlightIndex === -1 ? "#3b82f6" : items[highlightIndex].color}
              />
            </div>
          </div>
            );
          })()}

          {/* Footer */}
          <div
            style={{
              fontSize: 13,
              color: "#94a3b8",
              letterSpacing: 3,
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            The Explainer
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* DETAIL LAYER */}
      {/* ================================================================ */}
      {detailOpacity > 0 && activeItem && (() => {
        const conceptStartFrame = activeItem ? Math.floor(activeItem.start * fps) : 0;
        const framesInDetail = frame - conceptStartFrame - Math.floor(TRANSITION_TOTAL * fps);
        const cameraScale = framesInDetail >= 0
          ? interpolate(framesInDetail, [0, 18], [1.06, 1.0], { 
              extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic)
            })
          : 1.0;
          
        const activeScene = activeItem.scenes && activeItem.scenes.length > 0
          ? activeItem.scenes.find(s => timeSec >= s.start && timeSec <= s.end) || activeItem.scenes[0]
          : null;
          
        return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${cameraScale})`,
            transformOrigin: 'center center',
          }}
        >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "60px 80px 50px",
            opacity: detailOpacity,
            userSelect: "none",
          }}
        >
          {/* Concept Name */}
          <h2
            style={{
              fontSize: 56,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 4,
              margin: 0,
              color: "#0f172a",
              textShadow: "none",
            }}
          >
            {activeItem.name}
          </h2>

          {/* Center Side-by-side Badge and Stickman Animation */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              justifyContent: "space-around",
              alignItems: "center",
              width: "100%",
              flexGrow: 1,
              padding: "20px 40px",
            }}
          >
            {/* Left: Whiteboard Sketchpad or Concept Badge Fallback */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                transform: `scale(${detailBadgeScale})`,
                transformOrigin: "center center",
                position: "relative",
              }}
            >
              {activeScene ? (
                <div
                  style={{
                    width: 380,
                    height: 380,
                    backgroundColor: "#fbfbf9",
                    backgroundImage: "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                    border: "6px solid #1e293b",
                    borderRadius: 16,
                    boxShadow: "0 16px 36px rgba(0,0,0,0.1)",
                    padding: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "visible"
                  }}
                >
                  <svg
                    viewBox="0 0 100 100"
                    style={{ width: "100%", height: "100%", overflow: "visible" }}
                    dangerouslySetInnerHTML={{ __html: activeScene.sketch }}
                  />
                  
                  {/* Miniature Concept Badge in the top-right corner */}
                  <div
                    style={{
                      position: "absolute",
                      top: -15,
                      right: -15,
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      backgroundColor: activeItem.color,
                      border: "3px solid #1e293b",
                      boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 26,
                      userSelect: "none"
                    }}
                  >
                    {activeItem.emoji}
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      position: "absolute",
                      width: 380,
                      height: 380,
                      borderRadius: "50%",
                      background: `radial-gradient(circle, ${activeItem.color} 0%, transparent 70%)`,
                      opacity: 0.25,
                    }}
                  />
                  <div
                    style={{
                      width: 320,
                      height: 320,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: activeItem.color,
                      border: "8px solid #1e293b",
                      boxShadow: `0 12px 30px ${activeItem.color}40, 0 8px 24px rgba(0,0,0,0.12)`,
                      position: "relative",
                    }}
                  >
                    <BadgeIcon name={activeItem.name} emoji={activeItem.emoji} size={200} />
                    <div
                      style={{
                        position: "absolute",
                        top: -15,
                        right: -15,
                        fontSize: 64,
                        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.15))",
                        transform: `rotate(${Math.sin(frame / 8) * 10}deg)`,
                      }}
                    >
                      {activeItem.emoji}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Right: Stickman Presenter */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                transform: `scale(${detailBadgeScale})`,
                transformOrigin: "center center",
              }}
            >
              <Stickman
                frame={frame}
                timeSec={timeSec}
                words={activeWords}
                items={items}
                poseIndex={activeConceptIndex}
                activeColor={activeItem.color}
              />
            </div>
          </div>

          {/* Subtitles */}
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "center",
              textAlign: "center",
              paddingBottom: 10,
              minHeight: 80,
            }}
          >
            {activeWords.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  gap: "6px 14px",
                  maxWidth: "85%",
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
                  padding: "20px 35px",
                  borderRadius: 20,
                  border: "2px solid #e2e8f0",
                }}
              >
                {activeWords.map((w, idx) => {
                  const isActive = timeSec >= w.start && timeSec <= w.end;
                  const wordActiveFrame = Math.floor(w.start * fps);
                  const wordEndFrame = Math.floor(w.end * fps);
                  
                  const scale = isActive
                    ? interpolate(frame - wordActiveFrame, [0, 4], [1.0, 1.12], {
                        extrapolateRight: "clamp",
                        extrapolateLeft: "clamp",
                        easing: Easing.out(Easing.quad)
                      })
                    : interpolate(frame - wordEndFrame, [0, 4], [1.12, 1.0], {
                        extrapolateRight: "clamp",
                        extrapolateLeft: "clamp",
                        easing: Easing.out(Easing.quad)
                      });

                  return (
                    <span
                      key={idx}
                      style={{
                        fontSize: 38,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: 1,
                        color: isActive ? activeItem.color : "#64748b",
                        textShadow: isActive
                          ? `0 0 10px ${activeItem.color}40`
                          : "none",
                        transform: `scale(${scale})`,
                        display: "inline-block",
                      }}
                    >
                      {w.word}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>
        );
      })()}

      {/* ================================================================ */}
      {/* AUDIO TRACKS */}
      {/* ================================================================ */}

      {/* Background Music */}
      {bgmUrl && <Audio src={staticFile(bgmUrl)} volume={0.06} loop />}

      {/* Transition SFX on each concept start */}
      {sfxUrl &&
        items.map((item, index) => {
          const startFrame = Math.floor(item.start * fps);
          return (
            <Sequence
              key={`sfx-${index}`}
              from={startFrame}
              durationInFrames={Math.ceil(fps * 1.5)}
            >
              <Audio src={staticFile(sfxUrl)} volume={0.25} />
            </Sequence>
          );
        })}

      {/* Voiceover */}
      {audioUrl && <Audio src={staticFile(audioUrl)} />}
    </AbsoluteFill>
  );
};
