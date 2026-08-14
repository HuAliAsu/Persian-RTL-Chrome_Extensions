'use strict';

importScripts('core.js');

const {
  SETTINGS_SCHEMA_VERSION,
  isUrlEnabled,
  migrateSettings,
  normalizeFontName,
  normalizeHostname,
  normalizeSiteRules
} = PersianExtensionCore;

const ICON_SIZE = 128;
const ACTIVE_DOT_COLOR = '#22c55e';
let activeIconImageDataPromise = null;

async function buildActiveIconImageData() {
  const response = await fetch(chrome.runtime.getURL('icon.png'));
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(ICON_SIZE, ICON_SIZE);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, ICON_SIZE, ICON_SIZE);

  const radius = ICON_SIZE * 0.25;
  const cx = ICON_SIZE - radius - 2;
  const cy = ICON_SIZE - radius - 2;

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = ACTIVE_DOT_COLOR;
  ctx.fill();

  return ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
}

function getActiveIconImageData() {
  if (!activeIconImageDataPromise) activeIconImageDataPromise = buildActiveIconImageData();
  return activeIconImageDataPromise;
}

const DEFAULT_AI_SITES = [
  'chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com',
  'bard.google.com', 'copilot.microsoft.com', 'bing.com', 'you.com',
  'perplexity.ai', 'poe.com', 'character.ai', 'beta.character.ai',
  'huggingface.co', 'replicate.com', 'cohere.com', 'ai.google.com',
  'assistant.google.com', 'mistral.ai', 'chat.mistral.ai', 'groq.com',
  'grok.x.ai', 'x.ai', 'deepmind.com', 'inflection.ai', 'pi.ai',
  'meta.ai', 'llama.meta.com', 'writesonic.com', 'jasper.ai',
  'copy.ai', 'rytr.me', 'sudowrite.com', 'novelai.net', 'inferkit.com',
  'chat.deepseek.com', 'deepseek.com', 'kimi.moonshot.cn', 'tongyi.aliyun.com',
  'yiyan.baidu.com', 'xinghuo.xfyun.cn', 'tiangong.cn', 'doubao.com',
  'hailuoai.com', 'chatglm.cn', 'sensechat.sensetime.com',
  'wrtn.ai', 'clova.ai', 'hyperclova.ai', 'clovax.naver.com',
  'jais.ai', 'allam.ai', 'aya.cohere.com',
  'phind.com', 'blackboxai.com', 'codeium.com', 'tabnine.com',
  'github.com/copilot', 'cursor.sh', 'replit.com',
  'midjourney.com', 'dall-e.com', 'stability.ai', 'runwayml.com',
  'elevenlabs.io', 'suno.ai', 'udio.com',
  'n8n.io', 'zapier.com/ai', 'make.com',
  'dify.ai', 'flowise.ai', 'langchain.com',
  'openrouter.ai', 'together.ai', 'anyscale.com',
  'chat.forefront.ai', 'nat.dev', 'vercel.ai',
  'aistudio.google.com', 'labs.google.com'
];

function persistMigratedSettings() {
  chrome.storage.local.get(null, existing => {
    if (chrome.runtime.lastError) return;
    if (existing.settingsSchemaVersion === SETTINGS_SCHEMA_VERSION &&
        existing.selectedFont === normalizeFontName(existing.selectedFont)) return;
    chrome.storage.local.set(migrateSettings(existing, DEFAULT_AI_SITES), () => {
      void chrome.runtime.lastError;
    });
  });
}

function isActivatableUrl(url) {
  return /^https?:/i.test(url || '');
}

async function syncActionState(tabId, url) {
  if (!isActivatableUrl(url)) {
    await chrome.action.setPopup({ tabId, popup: 'popup.html' });
    await chrome.action.setIcon({ tabId, path: 'icon.png' });
    return;
  }
  const stored = await chrome.storage.local.get(['globalEnabled', 'enabledSites']);
  const active = stored.globalEnabled !== false &&
    isUrlEnabled(normalizeSiteRules(stored.enabledSites || []), url);
  await chrome.action.setPopup({ tabId, popup: active ? 'popup.html' : '' });
  if (active) await chrome.action.setIcon({ tabId, imageData: await getActiveIconImageData() });
  else await chrome.action.setIcon({ tabId, path: 'icon.png' });
}

async function syncAllTabs() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map(tab => tab.id !== undefined ? syncActionState(tab.id, tab.url) : null));
}

chrome.runtime.onInstalled.addListener(() => {
  persistMigratedSettings();
  syncAllTabs();
});
chrome.runtime.onStartup.addListener(() => {
  persistMigratedSettings();
  syncAllTabs();
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, tab => {
    if (chrome.runtime.lastError) return;
    syncActionState(tabId, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) syncActionState(tabId, tab.url);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  if ('enabledSites' in changes || 'globalEnabled' in changes) syncAllTabs();
});

chrome.action.onClicked.addListener(async tab => {
  if (!tab?.id || !isActivatableUrl(tab.url)) return;
  let hostname;
  try {
    hostname = normalizeHostname(new URL(tab.url).hostname);
  } catch (_error) {
    return;
  }
  if (!hostname) return;

  const stored = await chrome.storage.local.get(['enabledSites']);
  const rules = normalizeSiteRules(stored.enabledSites || []);
  if (!isUrlEnabled(rules, tab.url)) rules.push({ hostname, includeSubdomains: false, paths: null });
  await chrome.storage.local.set({ enabledSites: rules });
  await syncActionState(tab.id, tab.url);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'persian-extension:get-top-url') return false;
  sendResponse({ url: sender.tab?.url || sender.url || '' });
  return false;
});
