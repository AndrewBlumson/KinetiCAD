type Point3 = [number, number, number];
type Point2 = [number, number];

// Authored orthographic illustration in DemoArtwork's 400 × 200 view box.
// Its six linked actuators follow the fixture's actual staggered anchor pattern.
const baseAngles = [15, 105, 135, 225, 255, 345];
const deckAngles = [45, 75, 165, 195, 285, 315];
const viewAngle = -25 * Math.PI / 180;
const pointOnCircle = (radius: number, degrees: number, z: number): Point3 => [
  radius * Math.cos(degrees * Math.PI / 180), radius * Math.sin(degrees * Math.PI / 180), z,
];
const project = ([x, y, z]: Point3): Point2 => [
  200 + 0.8 * (x * Math.cos(viewAngle) - y * Math.sin(viewAngle)),
  155 + 0.23 * (x * Math.sin(viewAngle) + y * Math.cos(viewAngle)) - 0.55 * z,
];
const mix = (a: Point3, b: Point3, t: number): Point3 => a.map((value, i) => value + (b[i] - value) * t) as Point3;
const ring = (z: number, outer: number, inner: number) => {
  const y = 155 - 0.55 * z;
  const ellipse = (r: number) => `M${200 - r * 0.8} ${y}a${r * 0.8} ${r * 0.23} 0 1 0 ${r * 1.6} 0a${r * 0.8} ${r * 0.23} 0 1 0 ${-r * 1.6} 0`;
  return `${ellipse(outer)} ${ellipse(inner)}`;
};

export function StewartArtwork({ metal, gold, accent }: { metal: string; gold: string; accent: string }) {
  const legs = baseAngles.map((angle, i) => {
    const base = pointOnCircle(110, angle, 12);
    const deck = pointOnCircle(75, deckAngles[i], 160);
    const length = Math.hypot(...deck.map((value, axis) => value - base[axis]));
    return { i, base, deck, length, depth: project(base)[1] + project(deck)[1] };
  }).sort((a, b) => a.depth - b.depth);

  return (
    <g>
      <ellipse cx="200" cy="181" rx="111" ry="14" fill="#020612" fillOpacity=".55" />
      <path d={ring(0, 130, 72)} fill="#233146" fillRule="evenodd" stroke="#53667E" />
      <path d={ring(12, 130, 72)} fill="#44566E" fillRule="evenodd" stroke="#9EADBD" strokeWidth=".8" />
      {baseAngles.map((angle, i) => {
        const [x, y] = project(pointOnCircle(124, angle, 12));
        const [bx, by] = project(pointOnCircle(110, angle, 12));
        return <g key={i}>
          <ellipse cx={x} cy={y} rx="2.1" ry="1.2" fill="#0A1422" stroke="#BDCBD7" strokeWidth=".5" />
          <ellipse cx={bx} cy={by} rx="6.1" ry="3" fill="#1A273A" stroke="#8CA0B6" strokeWidth=".8" />
        </g>;
      })}

      {legs.map(({ i, base, deck, length }) => {
        const [bx, by] = project(base);
        const [tx, ty] = project(deck);
        const [sx, sy] = project(mix(base, deck, 10 / length));
        const [cx, cy] = project(mix(base, deck, 96 / length));
        const [kx, ky] = project(mix(base, deck, 89 / length));
        return <g key={i}>
          <path d={`M${bx} ${by}L${tx} ${ty}`} stroke="#0B1322" strokeWidth="8" strokeLinecap="round" />
          <path d={`M${bx} ${by}L${tx} ${ty}`} stroke={metal} strokeWidth="5" strokeLinecap="round" />
          <path d={`M${sx} ${sy}L${cx} ${cy}`} stroke="#0B1322" strokeWidth="15" strokeLinecap="butt" />
          <path d={`M${sx} ${sy}L${cx} ${cy}`} stroke={i % 2 === 0 ? gold : metal} strokeWidth="12" strokeLinecap="butt" />
          <path d={`M${sx - 2} ${sy}L${cx - 2} ${cy}`} stroke="#FFF" strokeOpacity=".23" strokeWidth="1.4" />
          <path d={`M${kx} ${ky}L${cx} ${cy}`} stroke="#32455B" strokeWidth="14" />
          <path d={`M${kx} ${ky}L${cx} ${cy}`} stroke={i % 2 === 0 ? '#D2AF69' : '#B1C1CF'} strokeWidth="11" />
          <circle cx={bx} cy={by} r="4.3" fill={metal} stroke="#E0E8F0" strokeWidth=".6" />
          <circle cx={tx} cy={ty} r="4.1" fill={metal} stroke="#E0E8F0" strokeWidth=".6" />
        </g>;
      })}

      <path d={ring(160, 94, 42)} fill="#50657C" fillRule="evenodd" stroke="#AEBECC" strokeWidth=".7" />
      <path d={ring(170, 94, 42)} fill={metal} fillRule="evenodd" stroke="#EBF2F6" strokeWidth=".8" />
      {deckAngles.map((angle, i) => {
        const [x, y] = project(pointOnCircle(75, angle, 170));
        const [fx, fy] = project(pointOnCircle(87, angle, 170));
        return <g key={i}>
          <ellipse cx={x} cy={y} rx="5.2" ry="2.2" fill="#26394D" stroke="#E6EDF3" strokeWidth=".7" />
          <ellipse cx={fx} cy={fy} rx="1.9" ry="1" fill="#15283D" />
        </g>;
      })}
      <path d="M321 69V145M317 75L321 69L325 75M317 139L321 145L325 139" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M299 69H313M307 145H313" stroke={accent} strokeOpacity=".35" strokeDasharray="3 3" />
      <text x="332" y="112" fill={accent} fontSize="9" fontFamily="sans-serif" letterSpacing="1.4" transform="rotate(-90 332 112)">LIFT</text>
    </g>
  );
}
