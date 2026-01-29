import type { ClientOptions } from "@anthropic-ai/sdk";
export type AuthType = "api_key" | "oauth_token" | "none";
export interface AuthConfig {
    type: AuthType;
    token: string;
}
/**
 * Get authentication config for Anthropic client.
 * Supports:
 * 1. ANTHROPIC_API_KEY env var (explicit API key)
 * 2. CLAUDE_CODE_OAUTH_TOKEN env var (OAuth token)
 * 3. Claude Code keychain (macOS) - OAuth token from subscription
 */
export declare function getAuthConfig(): AuthConfig;
/**
 * Get Anthropic client options based on auth type.
 * OAuth tokens need to use authToken, API keys use apiKey.
 */
export declare function getAnthropicClientOptions(): ClientOptions;
/**
 * Legacy function for backward compatibility
 * @deprecated Use getAuthConfig() or getAnthropicClientOptions() instead
 */
export declare function getAnthropicApiKey(): string;
/**
 * Check which auth method is being used
 */
export declare function getAuthMethod(): "api_key" | "oauth_token" | "keychain" | "none";
//# sourceMappingURL=auth.d.ts.map