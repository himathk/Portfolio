/* Structure-preserving text splitting.
 *
 * splitWords walks text nodes rather than rewriting innerHTML, so inline
 * markup inside a paragraph (the <em class="serif"> accents) survives the
 * split instead of being flattened.
 */

export function splitWords(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];

  (function walk(node: Node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = (child.textContent ?? '').split(/(\s+)/).filter(Boolean);
        if (!parts.length) return;

        const frag = document.createDocumentFragment();
        parts.forEach((p) => {
          if (/^\s+$/.test(p)) {
            frag.appendChild(document.createTextNode(p));
            return;
          }
          const s = document.createElement('span');
          s.className = 'word';
          s.textContent = p;
          out.push(s);
          frag.appendChild(s);
        });
        (child as ChildNode).replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
      }
    });
  })(root);

  return out;
}

export function splitChars(el: HTMLElement): HTMLElement[] {
  const text = el.textContent ?? '';
  el.textContent = '';

  return [...text].map((ch) => {
    const outer = document.createElement('span');
    outer.className = 'line';
    outer.style.display = 'inline-block';

    const inner = document.createElement('span');
    inner.className = 'line__i';
    inner.textContent = /\s/.test(ch) ? ' ' : ch;

    outer.appendChild(inner);
    el.appendChild(outer);
    return inner;
  });
}
