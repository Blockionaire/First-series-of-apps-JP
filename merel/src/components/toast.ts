let el: HTMLElement | null = null;
let hideTimer: number | undefined;

export function showToast(message: string): void {
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  // restart the slide-in even when a toast is already visible
  el.classList.remove('is-visible');
  void el.offsetHeight;
  el.classList.add('is-visible');
  window.clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => el?.classList.remove('is-visible'), 2800);
}
