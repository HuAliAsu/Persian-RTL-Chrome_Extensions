'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

test('detectDirection defaults to rtl when any strong rtl word is present', () => {
  const cases = [
    ['سلام دنیا', 'rtl'],
    ['Hello world', 'ltr'],
    ['123 - سلام', 'rtl'],
    ['123 - Hello', 'ltr'],
    ['Use متغیر in this code', 'rtl'],
    ['https://example.com', 'ltr'],
    ['۱۲۳۴', 'neutral'],
    ['متن فارسی with English', 'rtl']
  ];
  for (const [text, direction] of cases) assert.equal(core.detectDirection(text), direction, text);
});

test('detectDirection in firstStrong mode only looks at the first letter', () => {
  const cases = [
    ['سلام دنیا', 'rtl'],
    ['123 - سلام', 'rtl'],
    ['Use متغیر in this code', 'ltr'],
    ['متن فارسی with English', 'rtl']
  ];
  for (const [text, direction] of cases) {
    assert.equal(core.detectDirection(text, 'firstStrong'), direction, text);
  }
});

test('normalizeDetectionMode falls back to the default for unknown values', () => {
  assert.equal(core.normalizeDetectionMode('firstStrong'), 'firstStrong');
  assert.equal(core.normalizeDetectionMode('anyWord'), 'anyWord');
  assert.equal(core.normalizeDetectionMode('bogus'), core.DEFAULT_DETECTION_MODE);
  assert.equal(core.normalizeDetectionMode(undefined), core.DEFAULT_DETECTION_MODE);
});

test('legacy site rules retain path boundaries and remove duplicates', () => {
  const rules = core.normalizeSiteRules([
    'github.com/copilot',
    'github.com/copilot/',
    'zapier.com/ai'
  ]);
  assert.deepEqual(rules, [
    { hostname: 'github.com', includeSubdomains: false, paths: ['/copilot'] },
    { hostname: 'zapier.com', includeSubdomains: false, paths: ['/ai'] }
  ]);
  assert.equal(core.isUrlEnabled(rules, 'https://github.com/copilot/chat'), true);
  assert.equal(core.isUrlEnabled(rules, 'https://github.com/copilot-fake'), false);
  assert.equal(core.isUrlEnabled(rules, 'https://fakegithub.com/copilot'), false);
});

test('site matching is exact unless subdomains are explicitly enabled', () => {
  const exact = { hostname: 'example.com', includeSubdomains: false, paths: null };
  const nested = { hostname: 'example.com', includeSubdomains: true, paths: ['/chat'] };
  assert.equal(core.ruleMatchesUrl(exact, 'https://sub.example.com/'), false);
  assert.equal(core.ruleMatchesUrl(exact, 'https://fakeexample.com/'), false);
  assert.equal(core.ruleMatchesUrl(nested, 'https://sub.example.com/chat?q=1'), true);
  assert.equal(core.ruleMatchesUrl(nested, 'https://sub.example.com/chatty'), false);
});

test('migration preserves explicit false and an empty site list', () => {
  const migrated = core.migrateSettings({
    globalEnabled: false,
    enabledSites: []
  }, ['chatgpt.com']);
  assert.equal(migrated.globalEnabled, false);
  assert.equal(migrated.rtlDetectionMode, 'anyWord');
  assert.deepEqual(migrated.enabledSites, []);
  assert.equal(migrated.settingsSchemaVersion, core.SETTINGS_SCHEMA_VERSION);
  assert.deepEqual(core.migrateSettings(migrated, ['claude.ai']), migrated);
});

test('removed font selections fall back to the supported default', () => {
  assert.equal(core.normalizeFontName('Shabnam'), 'Vazirmatn[wght]');
  assert.equal(core.normalizeFontName('Samim'), 'Samim');
  assert.equal(
    core.migrateSettings({ selectedFont: 'Parastoo' }, []).selectedFont,
    'Vazirmatn[wght]'
  );
});

test('the no-font-change value is preserved instead of falling back', () => {
  assert.equal(core.normalizeFontName(core.NO_FONT_VALUE), core.NO_FONT_VALUE);
  assert.equal(
    core.migrateSettings({ selectedFont: core.NO_FONT_VALUE }, []).selectedFont,
    core.NO_FONT_VALUE
  );
});
