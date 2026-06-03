type AgentCharacterPortraitProps = {
  variant: number;
  label: string;
  className?: string;
};

const CHARACTER_STYLES = [
  {
    bg: "#dff5ff",
    halo: "#8edbf6",
    skin: "#f0b98c",
    hair: "#243142",
    shirt: "#00a1e1",
    collar: "#ffffff",
    blush: "#e89284",
  },
  {
    bg: "#fef3e2",
    halo: "#f5c86a",
    skin: "#d99763",
    hair: "#111827",
    shirt: "#f5a800",
    collar: "#fff7ed",
    blush: "#c8796f",
  },
  {
    bg: "#e9f9f0",
    halo: "#89d6aa",
    skin: "#c87952",
    hair: "#3b2417",
    shirt: "#059669",
    collar: "#f8fafc",
    blush: "#b96b62",
  },
  {
    bg: "#edf2ff",
    halo: "#a9bffc",
    skin: "#e2a979",
    hair: "#5b3424",
    shirt: "#4f6fd9",
    collar: "#ffffff",
    blush: "#d7867a",
  },
  {
    bg: "#f6edff",
    halo: "#c7a4f4",
    skin: "#b87654",
    hair: "#20111f",
    shirt: "#7c3aed",
    collar: "#faf5ff",
    blush: "#a95f69",
  },
  {
    bg: "#fff1f2",
    halo: "#f4a7b9",
    skin: "#f1c29b",
    hair: "#6f3b22",
    shirt: "#e11d48",
    collar: "#fff7f7",
    blush: "#dd8a8a",
  },
  {
    bg: "#eefaf7",
    halo: "#83d8cb",
    skin: "#8f5b43",
    hair: "#111827",
    shirt: "#0f766e",
    collar: "#ecfeff",
    blush: "#8f5c67",
  },
];

export default function AgentCharacterPortrait({ variant, label, className = "" }: AgentCharacterPortraitProps) {
  const style = CHARACTER_STYLES[variant % CHARACTER_STYLES.length];
  const hasLongHair = variant % 3 === 1;
  const hasSidePart = variant % 3 === 2;
  const hasGlasses = variant % 4 === 0;

  return (
    <div
      className={`relative isolate flex h-28 w-28 shrink-0 items-end justify-center overflow-hidden rounded-lg border border-white/70 shadow-sm ${className}`}
      style={{ background: `linear-gradient(145deg, ${style.bg}, #ffffff)` }}
      aria-label={`${label} character portrait`}
      role="img"
    >
      <div className="absolute bottom-0 left-1/2 h-28 w-28 -translate-x-1/2">
        <div
          className="absolute left-1/2 top-5 h-20 w-20 -translate-x-1/2 rounded-full opacity-70"
          style={{ backgroundColor: style.halo }}
        />
        <div
          className="absolute bottom-0 left-1/2 h-16 w-24 -translate-x-1/2 rounded-t-[42px] border border-black/5"
          style={{ backgroundColor: style.shirt }}
        />
        <div
          className="absolute bottom-9 left-1/2 h-8 w-12 -translate-x-1/2 rounded-b-[22px] rounded-t-lg border border-black/5"
          style={{ backgroundColor: style.skin }}
        />
        <div
          className="absolute bottom-2 left-1/2 h-11 w-14 -translate-x-1/2 rounded-t-[28px]"
          style={{ backgroundColor: style.collar }}
        />
        <div
          className="absolute bottom-[38px] left-1/2 h-[58px] w-[58px] -translate-x-1/2 rounded-[22px] border border-black/5"
          style={{ backgroundColor: style.skin }}
        />
        {hasLongHair && (
          <div
            className="absolute bottom-[35px] left-1/2 h-[68px] w-[68px] -translate-x-1/2 rounded-b-[20px] rounded-t-[28px]"
            style={{ backgroundColor: style.hair }}
          />
        )}
        <div
          className="absolute bottom-[78px] left-1/2 h-7 w-[62px] -translate-x-1/2 rounded-t-[28px]"
          style={{ backgroundColor: style.hair }}
        />
        {hasSidePart && (
          <div
            className="absolute bottom-[70px] left-[52px] h-8 w-8 -rotate-12 rounded-br-[22px] rounded-tl-[22px]"
            style={{ backgroundColor: style.hair }}
          />
        )}
        <div
          className="absolute bottom-[62px] left-[35px] h-2 w-2 rounded-full"
          style={{ backgroundColor: "#1f2937" }}
        />
        <div
          className="absolute bottom-[62px] right-[35px] h-2 w-2 rounded-full"
          style={{ backgroundColor: "#1f2937" }}
        />
        {hasGlasses && (
          <>
            <div className="absolute bottom-[58px] left-[28px] h-5 w-5 rounded-full border-2 border-slate-700/80" />
            <div className="absolute bottom-[58px] right-[28px] h-5 w-5 rounded-full border-2 border-slate-700/80" />
            <div className="absolute bottom-[67px] left-1/2 h-0.5 w-3 -translate-x-1/2 bg-slate-700/80" />
          </>
        )}
        <div
          className="absolute bottom-[51px] left-[26px] h-2 w-3 rounded-full opacity-60"
          style={{ backgroundColor: style.blush }}
        />
        <div
          className="absolute bottom-[51px] right-[26px] h-2 w-3 rounded-full opacity-60"
          style={{ backgroundColor: style.blush }}
        />
        <div className="absolute bottom-[49px] left-1/2 h-2 w-5 -translate-x-1/2 rounded-b-full border-b-2 border-slate-800/70" />
      </div>
    </div>
  );
}
