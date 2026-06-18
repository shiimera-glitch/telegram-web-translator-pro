// §0 — VARIANT SELECTORS & CONSTANTS
// Phase 0 of the micro-deployment plan.
// No behavior — pure constants only.

const ISK = location.pathname.startsWith('/k');
const VER = '4.0.0';
const PFX = 'tgtp3';

const MSGSEL = ISK
  ? '.message .text-content, .translatable-message, .message p'
  : '.bubble .message.spoilers-container, .bubble .text-content, .bubble .message-text, .translatable-message';

const BUBBLESEL = ISK ? '.message' : '.bubble';
