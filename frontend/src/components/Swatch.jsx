import { COLORS } from '../lib/scales.js';

/**
 * Plain 10 px symbol in the neutral color, matching the layer's map symbol:
 * disc (monitors, bridges), diamond (zone entries), square (DOT), plus outline / fill / steps variants.
 */
export function LayerSymbol({ kind, color = COLORS.neutral, size = 10 }) {
  const c = size / 2;
  let body;
  switch (kind) {
    case 'entry': {
      const h = c - 1.25;
      body = <polygon points={`${c},${c - h} ${c + h},${c} ${c},${c + h} ${c - h},${c}`} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />;
      break;
    }
    case 'line':
      body = <path d={`M1.5 ${c} H${size - 1.5}`} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeDasharray="3 2.5" />;
      break;
    case 'square':
      body = <rect x={0.5} y={0.5} width={size - 1} height={size - 1} rx={1.5} fill={color} />;
      break;
    case 'square-outline':
      body = <rect x={1} y={1} width={size - 2} height={size - 2} rx={1.5} fill="none" stroke={COLORS.insufficient} strokeWidth={1.25} />;
      break;
    case 'zone':
      body = <rect x={1} y={1} width={size - 2} height={size - 2} rx={2} fill="none" stroke={color} strokeWidth={1.25} />;
      break;
    case 'fill':
      body = <rect x={0} y={0} width={size} height={size} rx={2} fill={COLORS.dacFill} />;
      break;
    case 'ramp':
      body = <><rect x={0} y={0} width={size / 2 - 0.5} height={size} rx={1.5} fill="rgba(191,90,242,0.14)" /><rect x={size / 2 + 0.5} y={0} width={size / 2 - 0.5} height={size} rx={1.5} fill="rgba(191,90,242,0.4)" /></>;
      break;
    case 'hollow':
      body = <circle cx={c} cy={c} r={c - 1} fill="none" stroke={COLORS.insufficient} strokeWidth={1.5} />;
      break;
    case 'ring-grey':
      body = <circle cx={c} cy={c} r={c - 1} fill="none" stroke="var(--glyph-base)" strokeWidth={1} />;
      break;
    case 'ring-color':
      body = <circle cx={c} cy={c} r={c - 1} fill="none" stroke={color} strokeWidth={1} />;
      break;
    default:
      body = <circle cx={c} cy={c} r={c} fill={color} />;
  }
  return (
    <svg className="sym" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}

export default LayerSymbol;
