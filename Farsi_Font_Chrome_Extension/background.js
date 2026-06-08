const AI_SITES = [
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['globalEnabled', 'selectedFont', 'enabledSites'], (result) => {
    if (result.globalEnabled === undefined) {
      chrome.storage.local.set({
        globalEnabled: true,
        selectedFont: 'Vazirmatn[wght]',
        enabledSites: AI_SITES,
        siteFontSizes: {}
      });
    }
  });
});