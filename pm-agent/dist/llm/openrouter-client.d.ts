/**
 * OpenRouter API Client
 * Provides OpenAI-compatible interface for OpenRouter API
 */
export interface OpenRouterClientOptions {
    apiKey: string;
    model?: string;
    baseUrl?: string;
}
export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}
export interface ChatCompletionRequest {
    model: string;
    messages: ChatMessage[];
    max_tokens?: number;
    temperature?: number;
    response_format?: {
        type: "json_object";
    };
    stream?: boolean;
}
export interface ChatCompletionChoice {
    index: number;
    message: {
        role: "assistant";
        content: string;
    };
    finish_reason: string;
}
export interface ChatCompletionUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}
export interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChatCompletionChoice[];
    usage: ChatCompletionUsage;
}
export declare class OpenRouterClient {
    private apiKey;
    private model;
    private baseUrl;
    constructor(options: OpenRouterClientOptions);
    /**
     * Create a chat completion
     */
    createCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
    /**
     * Create a streaming chat completion
     */
    streamCompletion(request: ChatCompletionRequest): AsyncGenerator<string, void, unknown>;
    /**
     * Get the current model
     */
    getModel(): string;
    /**
     * Set a different model
     */
    setModel(model: string): void;
}
//# sourceMappingURL=openrouter-client.d.ts.map