/**
 * Stops the browser's autofill popup from stealing focus mid-word.
 *
 * The report behind this: type one character in any form field, a suggestion
 * popup opens over the input, and the next keystroke dismisses it - so the
 * field appears to deselect and the word never finishes. That is the browser's
 * autofill, not the app: every one of these fields is a controlled React input
 * with a value the server assigned, so there is nothing for the browser to
 * offer and the popup is purely in the way.
 *
 * `autocomplete="off"` on the page is ignored by Chrome for anything it thinks
 * is an account field, and the hidden-form trick is unreliable across browsers.
 * Setting the attribute on the element itself, after it is inserted, is the only
 * version that holds. Password fields are left alone: browsers are right to
 * offer to save those, and suppressing it breaks password managers.
 */
const AUTOFILL_EXEMPT = new Set(['password', 'hidden', 'submit', 'button', 'reset', 'checkbox', 'radio']);

function applyTo(root: ParentNode): void {
  const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  for (const field of fields) {
    if (AUTOFILL_EXEMPT.has(field.type)) continue;
    if (field.getAttribute('autocomplete') === 'off') continue;
    field.setAttribute('autocomplete', 'off');
    field.setAttribute('autocorrect', 'off');
    field.setAttribute('spellcheck', 'false');
  }
}

// Run now for anything already rendered, and again whenever React inserts more.
// MutationObserver covers every list and modal without touching a component.
applyTo(document);

const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node instanceof HTMLElement) applyTo(node);
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
