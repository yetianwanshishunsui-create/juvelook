// 线性图标（24×24，stroke = currentColor），与原型一致
const svg = (body, sw = 2) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const IC = {
  check: svg('<path d="M20 6 9 17l-5-5"/>', 3),
  org: svg('<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>'),
  doc: svg('<circle cx="12" cy="8" r="4"/><path d="M6 21v-1a6 6 0 0 1 12 0v1"/>'),
  pin: svg('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  none: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>'),
  alert: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>', 2.2),
  chev: svg('<path d="m9 18 6-6-6-6"/>'),
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
};
