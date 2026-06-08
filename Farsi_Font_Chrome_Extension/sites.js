document.addEventListener('DOMContentLoaded', () => {
  const siteList    = document.getElementById('siteList');
  const siteCount   = document.getElementById('siteCount');
  const searchInput = document.getElementById('searchInput');
  const backBtn     = document.getElementById('backBtn');

  let allSites = [];

  function renderList(filter = '') {
    const filtered = allSites.filter(s =>
      s.toLowerCase().includes(filter.toLowerCase())
    );

    siteCount.textContent = allSites.length;
    siteList.innerHTML = '';

    if (filtered.length === 0) {
      siteList.innerHTML = '<div class="empty-list">سایتی یافت نشد</div>';
      return;
    }

    filtered.forEach(site => {
      const item = document.createElement('div');
      item.className = 'site-item';
      item.innerHTML = `
        <span title="${site}">${site}</span>
        <button class="remove-btn" data-site="${site}">✕</button>
      `;
      siteList.appendChild(item);
    });

    siteList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const siteToRemove = btn.dataset.site;
        allSites = allSites.filter(s => s !== siteToRemove);
        chrome.storage.local.set({ enabledSites: allSites }, () => {
          renderList(searchInput.value);
        });
      });
    });
  }

  // بارگذاری
  chrome.storage.local.get(['enabledSites'], (result) => {
    allSites = result.enabledSites || [];
    renderList();
  });

  // جستجو
  searchInput.addEventListener('input', (e) => {
    renderList(e.target.value);
  });

  // بازگشت
  backBtn.addEventListener('click', () => {
    window.close();
  });
});