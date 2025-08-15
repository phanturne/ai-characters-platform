import { xai } from '@ai-sdk/xai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

// Create OpenRouter provider instance
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': openrouter.chat('deepseek/deepseek-chat-v3-0324:free'),
        'chat-model-reasoning': wrapLanguageModel({
          model: openrouter.chat('deepseek/deepseek-chat-v3-0324:free'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': openrouter.chat('deepseek/deepseek-chat-v3-0324:free'),
        'artifact-model': openrouter.chat(
          'deepseek/deepseek-chat-v3-0324:free',
        ),
      },
      imageModels: {
        'small-model': xai.imageModel('grok-2-image'),
      },
    });
