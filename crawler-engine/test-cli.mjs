import { UniversalAIAdapter } from './dist/adapters/universal.adapter.js';

const adapter = new UniversalAIAdapter({
  useBrowser: true,
  extractorMode: 'cli',
});

console.log('Testing crawler pipeline...');

try {
  const items = await adapter.crawl('https://news.ycombinator.com', {
    prompt: 'Извлеки топ-5 статей',
    extractionType: 'block',
  });
  console.log('Items found:', items.length);
  console.log(JSON.stringify(items.slice(0, 3), null, 2));
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await adapter.close();
}
