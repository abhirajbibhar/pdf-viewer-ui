/** Delegated tooltips: any element with data-tip gets a dark bubble after a short delay. */
export function setupTooltips(root: HTMLElement): void {
  let timer: number | undefined;
  let bubble: HTMLElement | null = null;
  const hide = () => { window.clearTimeout(timer); bubble?.remove(); bubble = null; };
  root.addEventListener('mouseover', (e) => {
    const el = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null;
    hide();
    if (!el || (el as HTMLButtonElement).disabled) return;
    timer = window.setTimeout(() => {
      bubble = document.createElement('div');
      bubble.className = 'ep-tooltip';
      bubble.textContent = el.getAttribute('data-tip');
      document.body.appendChild(bubble);
      const r = el.getBoundingClientRect();
      const bw = bubble.offsetWidth;
      bubble.style.left = `${Math.max(4, Math.min(window.innerWidth - bw - 4, r.left + r.width / 2 - bw / 2))}px`;
      bubble.style.top = `${r.bottom + 6}px`;
    }, 450);
  });
  root.addEventListener('mouseout', hide);
  root.addEventListener('pointerdown', hide);
  root.addEventListener('scroll', hide, true);
}
