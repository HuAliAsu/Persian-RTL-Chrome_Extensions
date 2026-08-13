(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.PersianExtensionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const SETTINGS_SCHEMA_VERSION = 2;
  const LETTER_REGEX = /\p{Letter}/u;
  const RTL_SCRIPT_REGEX = /[\p{Script=Arabic}\p{Script=Hebrew}]/u;
  const ARABIC_SCRIPT_REGEX = /\p{Script=Arabic}/u;

  function detectDirection(text) {
    for (const character of String(text || '')) {
      if (!LETTER_REGEX.test(character)) continue;
      return RTL_SCRIPT_REGEX.test(character) ? 'rtl' : 'ltr';
    }
    return 'neutral';
  }

  function containsPersianText(text) {
    for (const character of String(text || '')) {
      if (LETTER_REGEX.test(character) && ARABIC_SCRIPT_REGEX.test(character)) return true;
    }
    return false;
  }

  function normalizeHostname(hostname) {
    return String(hostname || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  }

  function normalizePath(pathname) {
    let path = String(pathname || '').trim();
    if (!path || path === '/') return '/';
    if (!path.startsWith('/')) path = `/${path}`;
    path = path.replace(/\/{2,}/g, '/');
    return path.length > 1 ? path.replace(/\/$/, '') : path;
  }

  function parseLegacyRule(value) {
    if (typeof value === 'string') {
      const trimmed = value.trim().replace(/^https?:\/\//i, '');
      const slashIndex = trimmed.indexOf('/');
      const rawHostname = slashIndex === -1 ? trimmed : trimmed.slice(0, slashIndex);
      const hostname = normalizeHostname(rawHostname.split(':')[0]);
      if (!hostname) return null;
      const rawPath = slashIndex === -1 ? '' : trimmed.slice(slashIndex).split(/[?#]/)[0];
      const legacyPath = rawPath ? normalizePath(rawPath) : null;
      return {
        hostname,
        includeSubdomains: false,
        paths: legacyPath && legacyPath !== '/' ? [legacyPath] : null
      };
    }

    if (!value || typeof value !== 'object') return null;
    const hostname = normalizeHostname(value.hostname);
    if (!hostname) return null;
    const paths = Array.isArray(value.paths)
      ? [...new Set(value.paths.map(normalizePath).filter(path => path !== '/'))]
      : null;
    return {
      hostname,
      includeSubdomains: value.includeSubdomains === true,
      paths: paths && paths.length ? paths : null
    };
  }

  function normalizeSiteRules(values) {
    const merged = new Map();
    for (const value of Array.isArray(values) ? values : []) {
      const rule = parseLegacyRule(value);
      if (!rule) continue;
      const key = `${rule.hostname}|${rule.includeSubdomains}`;
      const previous = merged.get(key);
      if (!previous || previous.paths === null || rule.paths === null) {
        merged.set(key, previous && previous.paths === null ? previous : rule);
        continue;
      }
      merged.set(key, { ...rule, paths: [...new Set([...previous.paths, ...rule.paths])] });
    }
    return [...merged.values()];
  }

  function pathMatches(pathname, rulePath) {
    const current = normalizePath(pathname);
    const expected = normalizePath(rulePath);
    return current === expected || current.startsWith(`${expected}/`);
  }

  function ruleMatchesUrl(ruleValue, urlValue) {
    const rule = parseLegacyRule(ruleValue);
    if (!rule) return false;
    let url;
    try {
      url = urlValue instanceof URL ? urlValue : new URL(urlValue);
    } catch (_error) {
      return false;
    }
    const hostname = normalizeHostname(url.hostname);
    const hostnameMatches = hostname === rule.hostname ||
      (rule.includeSubdomains && hostname.endsWith(`.${rule.hostname}`));
    if (!hostnameMatches) return false;
    return rule.paths === null || rule.paths.some(path => pathMatches(url.pathname, path));
  }

  function isUrlEnabled(rules, url) {
    return normalizeSiteRules(rules).some(rule => ruleMatchesUrl(rule, url));
  }

  function migrateSettings(existing, defaults) {
    const source = existing && typeof existing === 'object' ? existing : {};
    const hasEnabledSites = Object.prototype.hasOwnProperty.call(source, 'enabledSites');
    return {
      globalEnabled: source.globalEnabled !== undefined ? source.globalEnabled : true,
      rtlEnabled: source.rtlEnabled !== undefined ? source.rtlEnabled : true,
      selectedFont: source.selectedFont || 'Vazirmatn[wght]',
      enabledSites: normalizeSiteRules(hasEnabledSites ? source.enabledSites : defaults),
      siteFontSizes: source.siteFontSizes && typeof source.siteFontSizes === 'object'
        ? source.siteFontSizes
        : {},
      settingsSchemaVersion: SETTINGS_SCHEMA_VERSION
    };
  }

  return {
    SETTINGS_SCHEMA_VERSION,
    containsPersianText,
    detectDirection,
    isUrlEnabled,
    migrateSettings,
    normalizeHostname,
    normalizePath,
    normalizeSiteRules,
    pathMatches,
    ruleMatchesUrl
  };
});
