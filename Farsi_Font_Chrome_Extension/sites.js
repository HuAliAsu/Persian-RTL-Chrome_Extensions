'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const { normalizeSiteRules } = PersianExtensionCore;
  const siteList = document.getElementById('siteList');
  const siteCount = document.getElementById('siteCount');
  const searchInput = document.getElementById('searchInput');
  const backBtn = document.getElementById('backBtn');
  let allRules = [];

  function ruleLabel(rule) {
    const host = rule.includeSubdomains ? `*.${rule.hostname}` : rule.hostname;
    return rule.paths === null ? host : `${host}${rule.paths.join(`, ${host}`)}`;
  }

  function renderList(filter = '') {
    const query = filter.trim().toLowerCase();
    const filtered = allRules
      .map((rule, index) => ({ rule, index, label: ruleLabel(rule) }))
      .filter(item => item.label.toLowerCase().includes(query));

    siteCount.textContent = allRules.length;
    siteList.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-list';
      empty.textContent = 'سایتی یافت نشد';
      siteList.appendChild(empty);
      return;
    }

    for (const item of filtered) {
      const row = document.createElement('div');
      row.className = 'site-item';
      const label = document.createElement('span');
      label.title = item.label;
      label.textContent = item.label;
      const remove = document.createElement('button');
      remove.className = 'remove-btn';
      remove.type = 'button';
      remove.textContent = '✕';
      remove.setAttribute('aria-label', `حذف ${item.label}`);
      remove.addEventListener('click', () => {
        allRules.splice(item.index, 1);
        chrome.storage.local.set({ enabledSites: allRules }, () => renderList(searchInput.value));
      });
      row.append(label, remove);
      siteList.appendChild(row);
    }
  }

  chrome.storage.local.get(['enabledSites'], result => {
    allRules = normalizeSiteRules(result.enabledSites || []);
    renderList();
  });
  searchInput.addEventListener('input', event => renderList(event.target.value));
  backBtn.addEventListener('click', () => window.close());
});
