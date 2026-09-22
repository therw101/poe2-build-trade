/** Normalises a candidate element's text into a trade lookup name; null when it cannot be one. */
export function linkName(text: string | null | undefined): string | null {
  const name = (text ?? '').replace(/\s+/g, ' ').trim();
  return name.length >= 2 && name.length <= 80 && /\p{L}/u.test(name) ? name : null;
}

/**
 * Text leaves (elements without child elements) inside any `containers` match, as link
 * candidates. Sites without link markup render gem names as plain text in tooltip triggers.
 */
export function leafNames(root: ParentNode, containers: string, skipAttr: string): { el: HTMLElement; name: string }[] {
  const out: { el: HTMLElement; name: string }[] = [];
  const seen = new Set<Element>();
  for (const box of root.querySelectorAll<HTMLElement>(containers)) {
    for (const el of [box, ...box.querySelectorAll<HTMLElement>('*')]) {
      if (seen.has(el) || el.childElementCount > 0 || el.hasAttribute(skipAttr)) continue;
      seen.add(el);
      const name = linkName(el.textContent);
      if (name) out.push({ el, name });
      else el.setAttribute(skipAttr, '');
    }
  }
  return out;
}
