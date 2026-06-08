document.addEventListener('DOMContentLoaded', async () => {
  const globalToggle     = document.getElementById('globalToggle');
  const fontSelect       = document.getElementById('fontSelect');
  const fontSizeSlider   = document.getElementById('fontSizeSlider');
  const fontSizeValue    = document.getElementById('fontSizeValue');
  const siteToggle       = document.getElementById('siteToggle');
  const currentHostnameEl= document.getElementById('currentHostname');
  const settingsContainer= document.getElementById('settingsContainer');
  const siteCount        = document.getElementById('siteCount');
  const openSitesBtn     = document.getElementById('openSitesBtn');
  const siteLabel        = document.getElementById('siteLabel');

  // پیش‌نمایش فونت‌ها
  Array.from(fontSelect.options).forEach(option => {
    const fontUrl = chrome.runtime.getURL(`fonts/${option.value}.woff2`);
    const style = document.createElement('style');
    style.textContent = `
      @font-face { font-family: '${option.value}'; src: url('${fontUrl}') format('woff2'); }
      option[value="${option.value}"] { font-family: '${option.value}', Tahoma; }
    `;
    document.head.appendChild(style);
  });

  // وقتی افزونه غیرفعال است UI را کم‌رنگ کن
  function updateUIState(isDisabled) {
    settingsContainer.style.opacity = isDisabled ? '0.4' : '1';
    settingsContainer.style.pointerEvents = isDisabled ? 'none' : 'auto';
  }

  // hostname
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let hostname = '';
  try {
    hostname = new URL(tab.url).hostname;
    currentHostnameEl.textContent = hostname.length > 24
      ? hostname.substring(0, 24) + '…'
      : hostname;
    siteLabel.textContent = `(${hostname})`;
  } catch (e) {
    currentHostnameEl.textContent = 'نامشخص';
    siteToggle.disabled = true;
  }

  // بارگذاری تنظیمات
  chrome.storage.local.get(
    ['globalEnabled', 'selectedFont', 'enabledSites', 'siteFontSizes'],
    (result) => {
      const isDisabled = result.globalEnabled === false;
      globalToggle.checked = isDisabled;
      updateUIState(isDisabled);

      fontSelect.value = result.selectedFont || 'Vazirmatn[wght]';

      const siteFontSizes = result.siteFontSizes || {};
      const currentSize = siteFontSizes[hostname] || '100';
      fontSizeSlider.value = currentSize;
      fontSizeValue.textContent = currentSize + '%';

      const sites = result.enabledSites || [];
      siteToggle.checked = sites.includes(hostname);
      siteCount.textContent = sites.length;
    }
  );

  // غیرفعال کردن کل افزونه
  globalToggle.addEventListener('change', (e) => {
    // چک‌باکس تیک‌خورده = افزونه غیرفعال
    chrome.storage.local.set({ globalEnabled: !e.target.checked });
    updateUIState(e.target.checked);
  });

  fontSelect.addEventListener('change', (e) => {
    chrome.storage.local.set({ selectedFont: e.target.value });
  });

  fontSizeSlider.addEventListener('input', (e) => {
    fontSizeValue.textContent = e.target.value + '%';
  });

  // ذخیره سایز مختص این سایت
  fontSizeSlider.addEventListener('change', (e) => {
    chrome.storage.local.get(['siteFontSizes'], (result) => {
      const sizes = result.siteFontSizes || {};
      sizes[hostname] = e.target.value;
      chrome.storage.local.set({ siteFontSizes: sizes });
    });
  });

  siteToggle.addEventListener('change', (e) => {
    chrome.storage.local.get(['enabledSites'], (result) => {
      let sites = result.enabledSites || [];
      if (e.target.checked) {
        if (!sites.includes(hostname)) sites.push(hostname);
      } else {
        sites = sites.filter(s => s !== hostname);
      }
      chrome.storage.local.set({ enabledSites: sites }, () => {
        siteCount.textContent = sites.length;
      });
    });
  });

  // باز کردن صفحه لیست سایت‌ها
  openSitesBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('sites.html') });
  });
});