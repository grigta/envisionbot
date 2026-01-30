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
  response_format?: { type: "json_object" };
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

export class OpenRouterClient {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(options: OpenRouterClientOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || "google/gemini-3-flash-preview";
    this.baseUrl = options.baseUrl || "https://openrouter.ai/api/v1";
  }

  /**
   * Create a chat completion
   */
  async createCompletion(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    const body = {
      model: request.model || this.model,
      messages: request.messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      response_format: request.response_format,
      stream: false,
    };

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `🤖 OpenRouter API call (attempt ${attempt}/${maxRetries}):`,
          {
            model: body.model,
            messageCount: body.messages.length,
            maxTokens: body.max_tokens,
          }
        );

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            "HTTP-Referer": "https://github.com/envisionbot/pm-agent",
            "X-Title": "PM Agent",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `OpenRouter API error: ${response.status} ${response.statusText}\n${errorText}`
          );
        }

        const data = (await response.json()) as ChatCompletionResponse;

        console.log(
          `✅ OpenRouter API success:`,
          {
            model: data.model,
            tokensUsed: data.usage.total_tokens,
            finishReason: data.choices[0]?.finish_reason,
          }
        );

        return data;
      } catch (error) {
        lastError = error as Error;
        console.error(
          `❌ OpenRouter API error (attempt ${attempt}/${maxRetries}):`,
          lastError.message
        );

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw new Error(
      `OpenRouter API failed after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Create a streaming chat completion
   */
  async *streamCompletion(
    request: ChatCompletionRequest
  ): AsyncGenerator<string, void, unknown> {
    const url = `${this.baseUrl}/chat/completions`;

    const body = {
      model: request.model || this.model,
      messages: request.messages,
      max_tokens: request.max_tokens,
      temperature: request.temperature,
      response_format: request.response_format,
      stream: true,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
        "HTTP-Referer": "https://github.com/envisionbot/pm-agent",
        "X-Title": "PM Agent",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter API error: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              console.error("Failed to parse streaming chunk:", e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get the current model
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Set a different model
   */
  setModel(model: string): void {
    this.model = model;
  }
}
