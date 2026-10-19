let timer: number | undefined;
export function toast(message: string): void {
  document.querySelector('.ep-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'ep-toast';
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  window.clearTimeout(timer);
  timer = window.setTimeout(() => { el.classList.remove('is-in'); window.setTimeout(() => el.remove(), 200); }, 2200);
}
