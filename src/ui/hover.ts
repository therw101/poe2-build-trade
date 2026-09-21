import { SEARCH_ICON, h } from './dom.ts';

const HIDE_DELAY_MS = 300;

/**
 * One floating search button that follows the hovered inline link. Keeps guide text
 * clean: nothing is added next to the ~100 links on a page until the pointer is on one.
 */
export function createHoverButton(opts: {
  selector: string;
  label: string;
  onClick: (link: HTMLElement, button: HTMLButtonElement) => void;
}): { destroy: () => void } {
  const button = h('button', {
    type: 'button',
    class: 'b2t-root b2t-btn b2t-btn--hover',
    title: opts.label,
    'aria-label': opts.label,
    hidden: true,
  });
  button.innerHTML = SEARCH_ICON;
  document.body.append(button);

  let current: HTMLElement | null = null;
  let hideTimer = 0;

  const show = (link: HTMLElement) => {
    clearTimeout(hideTimer);
    current = link;
    const r = link.getBoundingClientRect();
    button.style.left = `${r.right + scrollX + 3}px`;
    button.style.top = `${r.top + scrollY + (r.height - 18) / 2}px`;
    button.hidden = false;
  };
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      button.hidden = true;
      current = null;
    }, HIDE_DELAY_MS);
  };

  const onOver = (e: MouseEvent) => {
    const link = (e.target as Element | null)?.closest?.<HTMLElement>(opts.selector);
    if (link) show(link);
  };
  const onOut = (e: MouseEvent) => {
    const from = (e.target as Element | null)?.closest?.(opts.selector);
    const to = e.relatedTarget as Node | null;
    if (from && !(to && (from.contains(to) || button.contains(to)))) scheduleHide();
  };

  button.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  button.addEventListener('mouseleave', scheduleHide);
  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'pointerup']) {
    button.addEventListener(type, (e) => e.stopPropagation());
  }
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (current) opts.onClick(current, button);
  });
  document.addEventListener('mouseover', onOver);
  document.addEventListener('mouseout', onOut);

  return {
    destroy() {
      clearTimeout(hideTimer);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      button.remove();
    },
  };
}
