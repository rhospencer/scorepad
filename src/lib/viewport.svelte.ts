/** Wide enough for the two-pane desktop layouts. Phones and narrow windows get one column. */
const WIDE = '(min-width: 900px)';

const media = typeof matchMedia === 'function' ? matchMedia(WIDE) : null;

/** Reactive: read `viewport.wide` in a component and it updates as the window resizes. */
export const viewport = $state({ wide: media?.matches ?? false });

media?.addEventListener('change', (e) => (viewport.wide = e.matches));
