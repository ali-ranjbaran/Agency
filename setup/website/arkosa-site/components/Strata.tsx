type Band = [x: number, y: number, w: number, h: number, tone: "s1" | "s2" | "s3" | "accent"];
const fill = { s1: "fill-s1", s2: "fill-s2", s3: "fill-s3", accent: "fill-accent" } as const;

function Bands({ bands }: { bands: Band[] }) {
  return bands.map(([x, y, w, h, t], i) => (
    <rect key={i} x={x} y={y} width={w} height={h} className={fill[t]} style={{ ["--i" as string]: i }} />
  ));
}

const HERO: Band[] = [
  [0, 0, 1200, 10, "s3"], [0, 14, 760, 6, "s2"], [772, 14, 428, 6, "s2"], [0, 24, 1200, 14, "s1"],
  [0, 42, 300, 5, "accent"], [312, 42, 888, 5, "s3"], [0, 51, 1200, 9, "s2"],
];
const NAME: Band[] = [
  [0, 0, 480, 34, "s1"], [0, 40, 290, 10, "s2"], [300, 40, 180, 10, "s2"], [0, 56, 480, 52, "s1"],
  [0, 114, 480, 8, "s3"], [0, 128, 130, 26, "s2"], [140, 128, 340, 26, "s2"], [0, 160, 480, 20, "accent"],
  [0, 186, 480, 60, "s1"], [0, 252, 210, 8, "s3"], [220, 252, 260, 8, "s3"], [0, 266, 480, 36, "s2"],
  [0, 308, 84, 12, "s1"], [94, 308, 386, 12, "s1"], [0, 326, 480, 34, "s1"],
];

export function HeroStrata() {
  return (
    <svg data-strata viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true" className="block h-[clamp(36px,5vw,60px)] w-full">
      <Bands bands={HERO} />
    </svg>
  );
}

export function NameStrata() {
  return (
    <svg data-strata viewBox="0 0 480 360" role="img" aria-label="Abstract graphic of horizontal rock strata" className="block h-auto w-full">
      <Bands bands={NAME} />
    </svg>
  );
}
