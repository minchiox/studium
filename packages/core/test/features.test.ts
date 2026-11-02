import { describe, expect, it } from 'vitest';
import { ENABLE_AI_FEATURES, FeatureDisabledError } from '../src/features.ts';
import { buildLlmRequest, generateQuizWithLlm } from '../src/llm.ts';

const config = { baseUrl: 'https://llm.example.com/v1', apiKey: 'k', model: 'm' };
const sources = [
  { id: 'C:1:1', courseCode: 'C', lesson: 1, paragraph: 1, title: 'P', text: 'Testo della lezione.' },
];

describe('AI features flag', () => {
  it('ships disabled', () => {
    expect(ENABLE_AI_FEATURES).toBe(false);
  });

  it('refuses to build any provider request while disabled', async () => {
    expect(() => buildLlmRequest(config, sources, 5)).toThrow(FeatureDisabledError);
    let called = false;
    const fetchImpl = async () => {
      called = true;
      return new Response('{}');
    };
    await expect(generateQuizWithLlm(fetchImpl, config, sources)).rejects.toThrow(/disabled/);
    expect(called).toBe(false);
  });
});
