'use strict';

const {
  containsPersianText,
  detectDirection,
  isUrlEnabled,
  normalizeDetectionMode,
  normalizeFontName,
  normalizeHostname,
  normalizeSiteRules,
  NO_FONT_VALUE
} = PersianExtensionCore;

const FONT_ATTR = 'data-persian-font';
const DIRECTION_ATTR = 'data-persian-direction';
const STYLE_ATTR = 'data-persian-extension-style';
const BLOCK_SELECTOR = 'p,li,blockquote,figcaption,td,th,h1,h2,h3,h4,h5,h6,article,[role="article"],[role="listitem"]';
const EDITOR_SELECTOR = 'textarea,input[type="text"],input[type="search"],[contenteditable="true"],[contenteditable="plaintext-only"]';
const INTERACTIVE_SELECTOR = 'button,a,input,select,textarea,[contenteditable],svg,[role="button"],[role="toolbar"],[role="navigation"],[role="tablist"]';
const EXCLUDED_SELECTOR = 'script,style,noscript,pre,code,kbd,samp,svg,math,.katex,.katex-display,.MathJax,.mathjax,.monaco-editor,.CodeMirror,.cm-editor,[role="code"],[data-language]';
const OBSERVER_OPTIONS = { childList: true, characterData: true, subtree: true };

let contextValid = true;
let settings = null;
let topUrl = window === window.top ? location.href : '';
let mutationTimer = null;
let urlTimer = null;
let composing = false;
const pendingNodes = new Set();
const rootObservers = new Map();
const listenerRoots = new Set();
const originalEditorDirections = new WeakMap();

function extensionCss(fontName, fontSize) {
  const multiplier = (Number.parseInt(fontSize, 10) / 100 || 1).toFixed(2);
  const fontBlock = fontName === NO_FONT_VALUE ? '' : `
    @font-face {
      font-family: 'PersianExtensionFont';
      src: url('${chrome.runtime.getURL(`fonts/${fontName}.woff2`)}') format('woff2');
      font-display: swap;
      unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F;
    }
    [${FONT_ATTR}] {
      font-family: 'PersianExtensionFont', Tahoma, Arial, sans-serif !important;
      font-size: ${multiplier}em !important;
    }
  `;
  return `
    ${fontBlock}
    [${DIRECTION_ATTR}="rtl"] {
      direction: rtl !important;
      text-align: start !important;
      unicode-bidi: plaintext !important;
    }
    [${DIRECTION_ATTR}] :is(pre,code,kbd,samp,.katex,.MathJax,.monaco-editor,.CodeMirror,.cm-editor,[role="code"],[data-language]) {
      direction: ltr !important;
      text-align: left !important;
      unicode-bidi: isolate !important;
    }
    [${FONT_ATTR}] :is(pre,code,kbd,samp,.katex,.MathJax,.monaco-editor,.CodeMirror,.cm-editor,[role="code"],[data-language]) {
      font-family: monospace !important;
      font-size: 1em !important;
    }
  `;
}

function isExtensionContextError(error) {
  return String(error?.message || error).includes('Extension context invalidated');
}

function invalidateContext(error) {
  if (isExtensionContextError(error)) {
    contextValid = false;
    cleanupLifecycle();
    return true;
  }
  return false;
}

function currentUrl() {
  return window === window.top ? location.href : topUrl;
}

function currentHostname() {
  try {
    return normalizeHostname(new URL(currentUrl()).hostname);
  } catch (_error) {
    return normalizeHostname(location.hostname);
  }
}

function isSiteActive() {
  return Boolean(settings?.globalEnabled !== false && isUrlEnabled(settings?.enabledSites, currentUrl()));
}

function effectiveFontEnabled() {
  return Boolean(isSiteActive() && settings?.selectedFont && settings.selectedFont !== NO_FONT_VALUE);
}

function effectiveRtlEnabled() {
  return isSiteActive();
}

function getRootStyle(root) {
  return root.querySelector?.(`style[${STYLE_ATTR}]`) || null;
}

function ensureRootStyle(root) {
  if (!effectiveFontEnabled() && !effectiveRtlEnabled()) {
    getRootStyle(root)?.remove();
    return;
  }
  let style = getRootStyle(root);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute(STYLE_ATTR, 'true');
    if (root instanceof Document) (root.head || root.documentElement).appendChild(style);
    else root.appendChild(style);
  }
  const sizes = settings.siteFontSizes || {};
  style.textContent = extensionCss(normalizeFontName(settings.selectedFont), sizes[currentHostname()] || '100');
}

function isExcluded(element) {
  return Boolean(element?.closest?.(EXCLUDED_SELECTOR));
}

function findTextBlock(node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!element || isExcluded(element) || element.closest?.(EDITOR_SELECTOR)) return null;
  const semantic = element.closest(BLOCK_SELECTOR);
  if (semantic && !semantic.matches('body,html,nav,aside')) return semantic;
  let candidate = element;
  while (candidate && !candidate.matches('body,html,nav,aside,main')) {
    if (
      candidate.tagName === 'DIV' &&
      candidate.querySelectorAll(':scope > p,:scope > article,:scope > section').length === 0 &&
      candidate.querySelectorAll(INTERACTIVE_SELECTOR).length === 0
    ) {
      return candidate;
    }
    candidate = candidate.parentElement;
  }
  return null;
}

function textWithoutExcludedDescendants(element) {
  const parts = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      return parent && !parent.closest(EXCLUDED_SELECTOR)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });
  let node;
  let length = 0;
  while ((node = walker.nextNode()) && length < 20000) {
    parts.push(node.data);
    length += node.data.length;
  }
  return parts.join(' ');
}

function updateBlock(element) {
  if (!element?.isConnected || isExcluded(element)) return;
  const text = textWithoutExcludedDescendants(element).trim();
  if (effectiveFontEnabled() && containsPersianText(text)) element.setAttribute(FONT_ATTR, 'true');
  else element.removeAttribute(FONT_ATTR);

  if (effectiveRtlEnabled() && detectDirection(text, settings.rtlDetectionMode) === 'rtl') element.setAttribute(DIRECTION_ATTR, 'rtl');
  else element.removeAttribute(DIRECTION_ATTR);
}

function editorText(editor) {
  if (editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) return editor.value;
  return editor.innerText || editor.textContent || '';
}

function rememberEditorDirection(editor) {
  if (originalEditorDirections.has(editor)) return;
  originalEditorDirections.set(editor, {
    hadAttribute: editor.hasAttribute('dir'),
    value: editor.getAttribute('dir')
  });
}

function restoreEditorDirection(editor) {
  const original = originalEditorDirections.get(editor);
  if (!original) return;
  if (original.hadAttribute) editor.setAttribute('dir', original.value);
  else editor.removeAttribute('dir');
  originalEditorDirections.delete(editor);
}

function updateEditor(editor) {
  if (!editor?.isConnected || isExcluded(editor)) return;
  const text = editorText(editor);
  if (effectiveFontEnabled() && containsPersianText(text)) editor.setAttribute(FONT_ATTR, 'true');
  else editor.removeAttribute(FONT_ATTR);

  if (effectiveRtlEnabled()) {
    rememberEditorDirection(editor);
    editor.setAttribute('dir', 'auto');
    editor.setAttribute(DIRECTION_ATTR, 'auto');
  } else {
    restoreEditorDirection(editor);
    editor.removeAttribute(DIRECTION_ATTR);
  }
}

function processNode(node) {
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) {
    updateBlock(findTextBlock(node));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

  const element = node.nodeType === Node.ELEMENT_NODE ? node : null;
  if (element?.matches(EDITOR_SELECTOR)) updateEditor(element);
  node.querySelectorAll?.(EDITOR_SELECTOR).forEach(updateEditor);

  if (element) updateBlock(findTextBlock(element));
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let textNode;
  const blocks = new Set();
  while ((textNode = walker.nextNode())) {
    const block = findTextBlock(textNode);
    if (block) blocks.add(block);
  }
  blocks.forEach(updateBlock);
  discoverOpenShadowRoots(node);
}

function removeAllEffects() {
  for (const root of rootObservers.keys()) {
    root.querySelectorAll?.(`[${FONT_ATTR}]`).forEach(element => element.removeAttribute(FONT_ATTR));
    root.querySelectorAll?.(`[${DIRECTION_ATTR}]`).forEach(element => {
      if (element.matches(EDITOR_SELECTOR)) restoreEditorDirection(element);
      element.removeAttribute(DIRECTION_ATTR);
    });
    getRootStyle(root)?.remove();
  }
}

function scanAllRoots() {
  for (const root of rootObservers.keys()) {
    ensureRootStyle(root);
    processNode(root instanceof Document ? root.documentElement : root);
  }
  if (!isSiteActive()) removeAllEffects();
}

function flushMutations() {
  mutationTimer = null;
  if (!contextValid || document.hidden) return;
  for (const node of pendingNodes) processNode(node);
  pendingNodes.clear();
}

function queueNode(node) {
  pendingNodes.add(node);
  if (mutationTimer !== null) return;
  mutationTimer = window.setTimeout(flushMutations, 80);
}

function handleMutations(records) {
  for (const record of records) {
    if (record.type === 'characterData') queueNode(record.target);
    else record.addedNodes.forEach(queueNode);
  }
}

function handleEditorInput(event) {
  const editor = event.target?.closest?.(EDITOR_SELECTOR);
  if (!editor || composing) return;
  updateEditor(editor);
}

function handleCompositionStart() {
  composing = true;
}

function handleCompositionEnd(event) {
  composing = false;
  handleEditorInput(event);
}

function attachRoot(root) {
  if (rootObservers.has(root)) return;
  const observer = new MutationObserver(handleMutations);
  rootObservers.set(root, observer);
  if (!document.hidden) observer.observe(root, OBSERVER_OPTIONS);
  root.addEventListener('input', handleEditorInput, true);
  root.addEventListener('compositionstart', handleCompositionStart, true);
  root.addEventListener('compositionend', handleCompositionEnd, true);
  listenerRoots.add(root);
  ensureRootStyle(root);
}

function discoverOpenShadowRoots(root) {
  if (!root?.querySelectorAll) return;
  const candidates = [];
  if (root.nodeType === Node.ELEMENT_NODE) candidates.push(root);
  root.querySelectorAll('*').forEach(element => candidates.push(element));
  for (const element of candidates) {
    if (element.shadowRoot?.mode === 'open') {
      attachRoot(element.shadowRoot);
      processNode(element.shadowRoot);
    }
  }
}

function refreshTopUrl() {
  if (!contextValid) return;
  if (window === window.top) {
    if (topUrl !== location.href) {
      topUrl = location.href;
      scanAllRoots();
    }
    return;
  }
  try {
    chrome.runtime.sendMessage({ type: 'persian-extension:get-top-url' }, response => {
      if (chrome.runtime.lastError || !response?.url || response.url === topUrl) return;
      topUrl = response.url;
      scanAllRoots();
    });
  } catch (error) {
    invalidateContext(error);
  }
}

function resumeObservers() {
  for (const [root, observer] of rootObservers) observer.observe(root, OBSERVER_OPTIONS);
  refreshTopUrl();
  scanAllRoots();
}

function pauseObservers() {
  rootObservers.forEach(observer => observer.disconnect());
  if (mutationTimer !== null) clearTimeout(mutationTimer);
  mutationTimer = null;
  pendingNodes.clear();
}

function cleanupLifecycle() {
  pauseObservers();
  if (urlTimer !== null) clearInterval(urlTimer);
  urlTimer = null;
  listenerRoots.forEach(root => {
    root.removeEventListener('input', handleEditorInput, true);
    root.removeEventListener('compositionstart', handleCompositionStart, true);
    root.removeEventListener('compositionend', handleCompositionEnd, true);
  });
  listenerRoots.clear();
}

function handlePageHide(event) {
  if (event.persisted) pauseObservers();
  else cleanupLifecycle();
}

function handlePageShow(event) {
  if (!event.persisted || !contextValid) return;
  if (urlTimer === null) urlTimer = window.setInterval(refreshTopUrl, 1000);
  resumeObservers();
}

function loadSettings() {
  try {
    chrome.storage.local.get(
      ['globalEnabled', 'rtlDetectionMode', 'selectedFont', 'enabledSites', 'siteFontSizes'],
      result => {
        if (chrome.runtime.lastError || !contextValid) return;
        settings = {
          globalEnabled: result.globalEnabled !== false,
          rtlDetectionMode: normalizeDetectionMode(result.rtlDetectionMode),
          selectedFont: normalizeFontName(result.selectedFont),
          enabledSites: normalizeSiteRules(result.enabledSites || []),
          siteFontSizes: result.siteFontSizes || {}
        };
        attachRoot(document);
        discoverOpenShadowRoots(document);
        refreshTopUrl();
        scanAllRoots();
      }
    );
  } catch (error) {
    invalidateContext(error);
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!contextValid || areaName !== 'local' || !settings) return;
  for (const [key, change] of Object.entries(changes)) {
    if (key === 'enabledSites') settings.enabledSites = normalizeSiteRules(change.newValue || []);
    else if (key === 'rtlDetectionMode') settings.rtlDetectionMode = normalizeDetectionMode(change.newValue);
    else if (['globalEnabled', 'selectedFont', 'siteFontSizes'].includes(key)) settings[key] = change.newValue;
  }
  refreshTopUrl();
  scanAllRoots();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseObservers();
  else if (contextValid) resumeObservers();
});
window.addEventListener('pagehide', handlePageHide);
window.addEventListener('pageshow', handlePageShow);
window.addEventListener('beforeunload', () => { contextValid = false; }, { once: true });

urlTimer = window.setInterval(refreshTopUrl, 1000);
if (document.documentElement) loadSettings();
else document.addEventListener('DOMContentLoaded', loadSettings, { once: true });
