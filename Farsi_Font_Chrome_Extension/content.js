const STYLE_ID = 'my-custom-font-style';
const DATA_ATTR = 'data-persian-font';
const PERSIAN_REGEX = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

let isContextValid = true;

window.addEventListener('beforeunload', () => {
  isContextValid = false;
});

function injectFontFace(fontName, fontSize) {
  if (!isContextValid) return;

  try {
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }

    const fontUrl = chrome.runtime.getURL(`fonts/${fontName}.woff2`);

    // ✅ تغییر: font-size به جای zoom
    // مثال: fontSize = "120" → font-size: 1.2em
    const fontSizeMultiplier = (parseInt(fontSize) / 100).toFixed(2);
    const sizeRule = fontSize && fontSize !== '100'
      ? `[${DATA_ATTR}] { font-size: ${fontSizeMultiplier}em !important; }`
      : '';

    styleEl.textContent = `
      @font-face {
        font-family: 'MyExtensionFont';
        src: url('${fontUrl}') format('woff2');
        font-display: swap;
        unicode-range: U+0600-06FF, U+0750-077F, U+FB50-FDFF, U+FE70-FEFF, U+200C-200F;
      }
      [${DATA_ATTR}] {
        font-family: 'MyExtensionFont', Tahoma, Arial, sans-serif !important;
      }
      ${sizeRule}
    `;
  } catch (err) {
    if (err.message.includes('Extension context invalidated')) {
      isContextValid = false;
    }
  }
}

function removeFont() {
  try {
    document.getElementById(STYLE_ID)?.remove();
    document.querySelectorAll(`[${DATA_ATTR}]`).forEach(el => el.removeAttribute(DATA_ATTR));
  } catch (err) {
    // خاموش است - نگران نباش
  }
}

function tagPersianElements() {
  if (!isContextValid) return;

  try {
    document.querySelectorAll(`[${DATA_ATTR}]`).forEach(el => el.removeAttribute(DATA_ATTR));
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (PERSIAN_REGEX.test(text)) {
        const parent = node.parentElement;
        if (parent && parent.tagName !== 'SCRIPT' && parent.tagName !== 'STYLE') {
          parent.setAttribute(DATA_ATTR, 'true');
        }
      }
    }
  } catch (err) {
    console.warn('Error tagging Persian elements:', err);
  }
}

let mutationTimer = null;

function checkAndApply() {
  if (!isContextValid) return;

  try {
    chrome.storage.local.get(
      ['globalEnabled', 'selectedFont', 'enabledSites', 'siteFontSizes'],
      (result) => {
        if (!isContextValid) return;

        const hostname = window.location.hostname;
        const enabledSites = result.enabledSites || [];
        const isSiteEnabled = enabledSites.includes(hostname);
        const siteFontSizes = result.siteFontSizes || {};
        const fontSize = siteFontSizes[hostname] || '100';

        if (result.globalEnabled !== false && isSiteEnabled && result.selectedFont) {
          injectFontFace(result.selectedFont, fontSize);
          tagPersianElements();
        } else {
          removeFont();
        }
      }
    );
  } catch (err) {
    if (err.message.includes('Extension context invalidated')) {
      isContextValid = false;
    }
  }
}

checkAndApply();

try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (!isContextValid || area !== 'local') return;
    checkAndApply();
  });
} catch (err) {
  // Extension غیرفعال است
}

let observer = null;
try {
  observer = new MutationObserver(() => {
    if (!isContextValid) {
      observer?.disconnect();
      return;
    }

    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(() => {
      if (!isContextValid) return;

      try {
        chrome.storage.local.get(['globalEnabled', 'selectedFont', 'enabledSites'], (result) => {
          if (!isContextValid) return;

          const hostname = window.location.hostname;
          const enabledSites = result.enabledSites || [];
          if (result.globalEnabled !== false && enabledSites.includes(hostname) && result.selectedFont) {
            tagPersianElements();
          }
        });
      } catch (err) {
        if (err.message.includes('Extension context invalidated')) {
          isContextValid = false;
          observer?.disconnect();
        }
      }
    }, 500);
  });

  observer.observe(document.body, { childList: true, subtree: true });
} catch (err) {
  // Observer failed - OK
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    observer?.disconnect();
  } else if (isContextValid) {
    observer?.observe(document.body, { childList: true, subtree: true });
  }
});