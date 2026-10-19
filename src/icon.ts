import { ICONS } from './icons';
import { fromHTML } from './dom';

export interface IconOptions {
  size?: number;
  strokeWidth?: number;
  primaryColor?: string;
  secondaryColor?: string;
  className?: string;
}

/** Returns an inline <svg> element for the given icon name. */
export function icon(name: string, opts: IconOptions = {}): Element {
  const def = ICONS[name];
  if (!def) {
    console.warn(`Icon not found: ${name}`);
    return document.createElement('span');
  }
  const { size = 24, strokeWidth = def.strokeWidth ?? 2, primaryColor, secondaryColor, className } = opts;
  const P = primaryColor ?? 'currentColor';
  const S = secondaryColor ?? 'currentColor';
  const body = def.body.replace(/__P__/g, P).replace(/__S__/g, S);
  const stroke = def.stroke === null ? '' : `stroke="${def.stroke.replace('__P__', P)}"`;
  const cls = className ? `class="${className}"` : '';
  return fromHTML(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
      `${stroke} stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ${cls} aria-hidden="true">${body}</svg>`,
  );
}
