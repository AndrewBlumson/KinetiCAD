import { useId } from 'react';

type DemoArtworkProps = {
  id: string;
  accent: string;
};

/** Authored illustrations, deliberately distinct from viewport screenshots. */
export function DemoArtwork({ id, accent }: DemoArtworkProps) {
  const uid = useId().replace(/:/g, '');
  const metal = `url(#${uid}-metal)`;
  const gold = `url(#${uid}-gold)`;

  return (
    <svg viewBox="0 0 400 200" fill="none" aria-hidden="true" className="h-full w-full">
      <defs>
        <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#E9F0F5" />
          <stop offset=".45" stopColor="#92A4B8" />
          <stop offset="1" stopColor="#45586F" />
        </linearGradient>
        <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#FFE2A0" />
          <stop offset=".48" stopColor="#C69745" />
          <stop offset="1" stopColor="#6D4B26" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop stopColor={accent} stopOpacity=".14" />
          <stop offset="1" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <pattern id={`${uid}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".75" fill="#8FA4BF" fillOpacity=".15" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill="#0B1322" />
      <rect width="400" height="200" fill={`url(#${uid}-grid)`} />
      <ellipse cx="200" cy="102" rx="185" ry="135" fill={`url(#${uid}-glow)`} />
      <path d="M26 173H374" stroke="#33475F" strokeOpacity=".4" />
      <path d="M26 173V165M374 173V165" stroke="#526780" strokeOpacity=".4" />
      {id === 'windmill' && <Windmill metal={metal} accent={accent} />}
      {id === 'orrery' && <Orrery metal={metal} gold={gold} accent={accent} />}
      {id === 'gyroscope' && <Gyroscope metal={metal} gold={gold} accent={accent} />}
      {id === 'kinetic-mobile' && <Mobile metal={metal} gold={gold} accent={accent} />}
      {id === 'material-studio' && <Materials metal={metal} gold={gold} />}
    </svg>
  );
}

function Windmill({ metal, accent }: { metal: string; accent: string }) {
  return (
    <>
      <ellipse cx="202" cy="169" rx="60" ry="9" fill="#020612" fillOpacity=".55" />
      <path d="M192 75H210V163C210 169 192 169 192 163Z" fill={metal} />
      <ellipse cx="201" cy="75" rx="9" ry="4" fill="#D7E2EC" />
      <path d="M197 65V87C197 90 205 90 205 87V65Z" fill="#718599" />
      <g transform="translate(201 65) rotate(-14) scale(1 .48)">
        <path d="M-78-7H-24V-62H-11V-24H11V-62H24V-7H78V7H24V62H11V24H-11V62H-24V7H-78Z" fill="#415269" transform="translate(0 8)" />
        <path d="M-78-7H-23V-23H-7V-78H7V-23H23V-7H78V7H23V23H7V78H-7V23H-23V7H-78Z" fill={metal} stroke="#DCE5ED" strokeWidth="1.5" />
        <circle r="26" fill={metal} stroke="#DAE7F2" strokeWidth="2" />
        <circle r="9" fill="#24354A" stroke="#A9B9C8" strokeWidth="3" />
      </g>
      <path d="M283 78C292 95 274 111 244 117" stroke={accent} strokeWidth="1.5" strokeDasharray="4 5" />
      <path d="M249 111L243 117L252 120" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M152 163H250" stroke="#425670" />
    </>
  );
}

function Orrery({ metal, gold, accent }: { metal: string; gold: string; accent: string }) {
  const planets = [
    { x: 172, y: 90, r: 5 }, { x: 227, y: 83, r: 7 },
    { x: 246, y: 116, r: 8 }, { x: 147, y: 123, r: 6 },
    { x: 106, y: 96, r: 11 }, { x: 281, y: 80, r: 10 },
    { x: 304, y: 134, r: 7 }, { x: 75, y: 139, r: 6 },
  ];
  return (
    <>
      {[35, 54, 74, 99, 132, 160].map((r) => <ellipse key={r} cx="200" cy="111" rx={r} ry={r * .37} stroke="#627A95" strokeOpacity=".23" />)}
      <ellipse cx="200" cy="165" rx="40" ry="7" fill="#020612" fillOpacity=".5" />
      <path d="M189 81H211V156C211 164 189 164 189 156Z" fill={metal} />
      {planets.map((p, i) => (
        <g key={i}>
          <path d={`M200 ${118 - i * 4}L${p.x} ${p.y}`} stroke={i % 2 === 0 ? '#758DA4' : '#A7B4C1'} strokeWidth="2.5" />
          <ellipse cx={p.x + 1} cy={p.y + 4} rx={p.r} ry={p.r * .65} fill="#26374A" />
          <ellipse cx={p.x} cy={p.y} rx={p.r} ry={p.r * .68} fill={i === 4 ? gold : metal} stroke="#DAE5F1" strokeWidth=".7" />
          {[2, 4, 6].includes(i) && <><path d={`M${p.x} ${p.y}l14 -6`} stroke="#7891A6" /><circle cx={p.x + 14} cy={p.y - 6} r="2.5" fill={accent} /></>}
          {i === 5 && <ellipse cx={p.x} cy={p.y} rx="17" ry="5" stroke={accent} strokeWidth="1.5" transform={`rotate(-14 ${p.x} ${p.y})`} />}
        </g>
      ))}
      <ellipse cx="200" cy="81" rx="11" ry="6" fill="#DCE5ED" />
      <path d="M200 48V63M188 52L192 60M213 52L209 60" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
    </>
  );
}

function Gyroscope({ metal, gold, accent }: { metal: string; gold: string; accent: string }) {
  return (
    <>
      <ellipse cx="200" cy="170" rx="63" ry="9" fill="#020612" fillOpacity=".5" />
      <path d="M166 156L201 143L236 156V165L200 178L166 165Z" fill={metal} />
      <path d="M166 156L200 168L236 156M200 168V178" stroke="#CFDEEA" strokeOpacity=".45" />
      <path d="M195 130H205V153L200 157L195 153Z" fill={metal} />
      <path d="M200 24V39M200 134V152" stroke="#C6D6E4" strokeWidth="3" />
      <ellipse cx="200" cy="87" rx="63" ry="56" transform="rotate(-25 200 87)" stroke="#344356" strokeWidth="9" />
      <ellipse cx="200" cy="84" rx="63" ry="56" transform="rotate(-25 200 84)" stroke={metal} strokeWidth="7" />
      <ellipse cx="200" cy="84" rx="24" ry="52" transform="rotate(32 200 84)" stroke={gold} strokeWidth="7" />
      <ellipse cx="200" cy="84" rx="36" ry="18" transform="rotate(-28 200 84)" fill="#243549" stroke="#65A8DC" strokeWidth="8" />
      <path d="M168 103L233 66" stroke="#E3EBF0" strokeWidth="3" />
      <circle cx="200" cy="84" r="6" fill={metal} />
      <circle cx="147" cy="111" r="4" fill="#DDE5EC" />
      <circle cx="253" cy="56" r="4" fill="#DDE5EC" />
      <path d="M275 68C285 89 280 105 266 116" stroke={accent} strokeDasharray="3 5" strokeOpacity=".65" />
    </>
  );
}

function Mobile({ metal, gold, accent }: { metal: string; gold: string; accent: string }) {
  return (
    <>
      <ellipse cx="201" cy="170" rx="102" ry="10" fill="#020612" fillOpacity=".4" />
      <path d="M196 45H204V166H196Z" fill={metal} />
      <ellipse cx="200" cy="165" rx="27" ry="8" fill={metal} />
      <path d="M110 68L200 44L291 70" stroke={metal} strokeWidth="7" strokeLinecap="round" />
      <path d="M110 68V97M291 70V101" stroke="#BDD0DF" strokeWidth="3" />
      <path d="M69 112L110 95L153 115M247 119L291 99L332 118" stroke={metal} strokeWidth="5" strokeLinecap="round" />
      <path d="M69 112V139M153 115V146M247 119V146M332 118V139" stroke="#7690A9" strokeWidth="2" />
      <ellipse cx="69" cy="141" rx="18" ry="9" fill={gold} stroke="#F1D08B" />
      <ellipse cx="153" cy="148" rx="14" ry="8" fill={accent} stroke="#A3DACC" />
      <ellipse cx="247" cy="149" rx="15" ry="8" fill={gold} stroke="#F1D08B" />
      <ellipse cx="332" cy="141" rx="18" ry="9" fill={accent} stroke="#A3DACC" />
      <circle cx="200" cy="44" r="5" fill="#DFE9F1" />
      <circle cx="110" cy="95" r="4" fill={accent} />
      <circle cx="291" cy="99" r="4" fill={accent} />
      <path d="M153 52C174 40 217 38 237 44" stroke={accent} strokeDasharray="3 5" strokeOpacity=".65" />
    </>
  );
}

function Materials({ metal, gold }: { metal: string; gold: string }) {
  const colours = [metal, '#A4B0BC', gold, '#8A8795', '#E4E5DB', '#E66F41', '#505769', '#8CCDCF'];
  return (
    <>
      <path d="M45 124L169 75L357 113V139L233 187L45 150Z" fill="#17263A" stroke="#415570" />
      <path d="M45 124L233 162L357 113M233 162V187" stroke="#526983" />
      {colours.map((colour, i) => {
        const x = 87 + (i % 4) * 56 + (i < 4 ? 54 : 0);
        const y = 109 + (i % 4) * 11 - (i < 4 ? 27 : 0);
        return (
          <g key={i}>
            <path d={`M${x - 17} ${y - 22}H${x + 17}V${y + 6}C${x + 17} ${y + 17} ${x - 17} ${y + 17} ${x - 17} ${y + 6}Z`} fill={colour} />
            <ellipse cx={x} cy={y - 22} rx="17" ry="8" fill={colour} stroke="#E7F1F4" strokeOpacity=".5" />
            <ellipse cx={x} cy={y - 22} rx="6" ry="3.5" fill="#17263A" stroke="#E7F1F4" strokeOpacity=".4" />
            <path d={`M${x + 11} ${y - 16}V${y + 6}`} stroke="#FFF" strokeOpacity=".15" />
          </g>
        );
      })}
    </>
  );
}
