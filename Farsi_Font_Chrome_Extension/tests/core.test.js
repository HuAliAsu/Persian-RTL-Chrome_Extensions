'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../core.js');

test('detectDirection follows the first strong letter', () => {
  const cases = [
    ['سلام دنیا', 'rtl'],
    ['Hello world', 'ltr'],
    ['123 - سلام', 'rtl'],
    ['123 - Hello', 'ltr'],
    ['Use متغیر in this code', 'ltr'],
    ['https://example.com', 'ltr'],
    ['۱۲۳۴', 'neutral'],
    ['متن فارسی with English', 'rtl']
  ];
  for (const [text, direction] of cases) assert.equal(core.detectDirection(text), direction, text);
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
    rtlEnabled: false,
    enabledSites: []
  }, ['chatgpt.com']);
  assert.equal(migrated.globalEnabled, false);
  assert.equal(migrated.rtlEnabled, false);
  assert.deepEqual(migrated.enabledSites, []);
  assert.equal(migrated.settingsSchemaVersion, core.SETTINGS_SCHEMA_VERSION);
  assert.deepEqual(core.migrateSettings(migrated, ['claude.ai']), migrated);
});
