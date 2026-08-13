'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  const { normalizeFontName, normalizeHostname, normalizeSiteRules, ruleMatchesUrl } = PersianExtensionCore;
  const globalToggle = document.getElementById('globalToggle');
  const rtlToggle = document.getElementById('rtlToggle');
  const fontSelect = document.getElementById('fontSelect');
  const fontSizeSlider = document.getElementById('fontSizeSlider');
  const fontSizeValue = document.getElementById('fontSizeValue');
  const siteToggle = document.getElementById('siteToggle');
  const currentHostnameEl = document.getElementById('currentHostname');
  const settingsContainer = document.getElementById('settingsContainer');
  const siteCount = document.getElementById('siteCount');
  const openSitesBtn = document.getElementById('openSitesBtn');
  const siteLabel = document.getElementById('siteLabel');

  for (const option of fontSelect.options) {
    const fontUrl = chrome.runtime.getURL(`fonts/${option.value}.woff2`);
    const style = document.createElement('style');
    style.textContent = `
      @font-face { font-family: '${option.value}'; src: url('${fontUrl}') format('woff2'); }
      option[value="${option.value}"] { font-family: '${option.value}', Tahoma; }
    `;
    document.head.appendChild(style);
  }

  function updateUIState(isDisabled) {
    settingsContainer.disabled = isDisabled;
    settingsContainer.classList.toggle('is-disabled', isDisabled);
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let pageUrl = '';
  let hostname = '';
  try {
    const url = new URL(tab.url);
    pageUrl = url.href;
    hostname = normalizeHostname(url.hostname);
    currentHostnameEl.textContent = hostname.length > 24 ? `${hostname.slice(0, 24)}…` : hostname;
    siteLabel.textContent = `(${hostname})`;
  } catch (_error) {
    currentHostnameEl.textContent = 'نامشخص';
    siteToggle.disabled = true;
    fontSizeSlider.disabled = true;
  }

  chrome.storage.local.get(
    ['globalEnabled', 'rtlEnabled', 'selectedFont', 'enabledSites', 'siteFontSizes'],
    result => {
      const isDisabled = result.globalEnabled === false;
      const rules = normalizeSiteRules(result.enabledSites || []);
      globalToggle.checked = isDisabled;
      rtlToggle.checked = result.rtlEnabled !== false;
      fontSelect.value = normalizeFontName(result.selectedFont);

      const currentSize = (result.siteFontSizes || {})[hostname] || '100';
      fontSizeSlider.value = currentSize;
      fontSizeValue.textContent = `${currentSize}%`;
      siteToggle.checked = rules.some(rule => ruleMatchesUrl(rule, pageUrl));
      siteCount.textContent = rules.length;
      updateUIState(isDisabled);
    }
  );

  globalToggle.addEventListener('change', event => {
    const disabled = event.target.checked;
    chrome.storage.local.set({ globalEnabled: !disabled });
    updateUIState(disabled);
  });

  rtlToggle.addEventListener('change', event => {
    chrome.storage.local.set({ rtlEnabled: event.target.checked });
  });

  fontSelect.addEventListener('change', event => {
    chrome.storage.local.set({ selectedFont: event.target.value });
  });

  fontSizeSlider.addEventListener('input', event => {
    fontSizeValue.textContent = `${event.target.value}%`;
  });

  fontSizeSlider.addEventListener('change', event => {
    if (!hostname) return;
    chrome.storage.local.get(['siteFontSizes'], result => {
      const sizes = { ...(result.siteFontSizes || {}), [hostname]: event.target.value };
      chrome.storage.local.set({ siteFontSizes: sizes });
    });
  });

  siteToggle.addEventListener('change', event => {
    if (!hostname || !pageUrl) return;
    chrome.storage.local.get(['enabledSites'], result => {
      let rules = normalizeSiteRules(result.enabledSites || []);
      if (event.target.checked) {
        if (!rules.some(rule => ruleMatchesUrl(rule, pageUrl))) {
          rules.push({ hostname, includeSubdomains: false, paths: null });
        }
      } else {
        rules = rules.filter(rule => !ruleMatchesUrl(rule, pageUrl));
      }
      chrome.storage.local.set({ enabledSites: rules }, () => {
        siteCount.textContent = rules.length;
      });
    });
  });

  openSitesBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('sites.html') });
  });
});
