'use strict';

importScripts('core.js');

const { SETTINGS_SCHEMA_VERSION, migrateSettings, normalizeFontName } = PersianExtensionCore;

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
        existing.rtlEnabled !== undefined &&
        existing.selectedFont === normalizeFontName(existing.selectedFont)) return;
    chrome.storage.local.set(migrateSettings(existing, DEFAULT_AI_SITES), () => {
      void chrome.runtime.lastError;
    });
  });
}

chrome.runtime.onInstalled.addListener(persistMigratedSettings);
chrome.runtime.onStartup.addListener(persistMigratedSettings);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'persian-extension:get-top-url') return false;
  sendResponse({ url: sender.tab?.url || sender.url || '' });
  return false;
});
