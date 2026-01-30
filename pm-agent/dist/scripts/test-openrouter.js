/**
 * Test script for OpenRouter connectivity
 * Run with: npx tsx src/scripts/test-openrouter.ts
 */
import 'dotenv/config';
import { OpenRouterClient } from '../llm/openrouter-client.js';
async function testConnection() {
    console.log('🧪 Testing OpenRouter API connection...\n');
    // Check environment variables
    if (!process.env.OPENROUTER_API_KEY) {
        console.error('❌ OPENROUTER_API_KEY not found in environment');
        process.exit(1);
    }
    const model = process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview';
    console.log(`📡 Using model: ${model}`);
    console.log(`🔑 API key: ${process.env.OPENROUTER_API_KEY.slice(0, 20)}...`);
    console.log();
    const client = new OpenRouterClient({
        apiKey: process.env.OPENROUTER_API_KEY,
        model,
    });
    try {
        console.log('📤 Sending test request...');
        const startTime = Date.now();
        const response = await client.createCompletion({
            model,
            messages: [
                {
                    role: 'user',
                    content: 'Ответь "OK" одним словом если ты работаешь.',
                },
            ],
            max_tokens: 10,
        });
        const duration = Date.now() - startTime;
        console.log('✅ OpenRouter API is working!\n');
        console.log('📊 Response details:');
        console.log(`  Model: ${response.model}`);
        console.log(`  Content: ${response.choices[0].message.content}`);
        console.log(`  Tokens used: ${response.usage.total_tokens}`);
        console.log(`  Duration: ${duration}ms`);
        console.log();
        // Test JSON mode
        console.log('🧪 Testing JSON mode...');
        const jsonStartTime = Date.now();
        const jsonResponse = await client.createCompletion({
            model,
            messages: [
                {
                    role: 'user',
                    content: 'Верни JSON объект с полями: status (строка "success"), message (строка "Тест пройден")',
                },
            ],
            max_tokens: 50,
            response_format: { type: 'json_object' },
        });
        const jsonDuration = Date.now() - jsonStartTime;
        const parsed = JSON.parse(jsonResponse.choices[0].message.content);
        console.log('✅ JSON mode is working!\n');
        console.log('📊 JSON Response:');
        console.log(`  Parsed: ${JSON.stringify(parsed, null, 2)}`);
        console.log(`  Tokens used: ${jsonResponse.usage.total_tokens}`);
        console.log(`  Duration: ${jsonDuration}ms`);
        console.log();
        console.log('🎉 All tests passed! OpenRouter integration is ready.');
    }
    catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}
testConnection().catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
});
//# sourceMappingURL=test-openrouter.js.map