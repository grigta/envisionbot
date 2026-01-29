import { execSync } from "child_process";
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
export function getAuthConfig(): AuthConfig {
  // 1. Check explicit API key (sk-ant-api...)
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("Using ANTHROPIC_API_KEY from environment");
    return { type: "api_key", token: process.env.ANTHROPIC_API_KEY };
  }

  // 2. Check Claude Code OAuth token env var
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.log("Using CLAUDE_CODE_OAUTH_TOKEN from environment");
    return { type: "oauth_token", token: process.env.CLAUDE_CODE_OAUTH_TOKEN };
  }

  // 3. Try to read from Claude Code keychain (macOS)
  try {
    const token = getTokenFromKeychain();
    if (token) {
      console.log("Using token from Claude Code keychain (Claude subscription)");
      return { type: "oauth_token", token };
    }
  } catch (error) {
    // Keychain not available or token not found
  }

  throw new Error(
    "No Anthropic API key found. Set ANTHROPIC_API_KEY, CLAUDE_CODE_OAUTH_TOKEN, or login to Claude Code."
  );
}

/**
 * Get Anthropic client options based on auth type.
 * OAuth tokens need to use authToken, API keys use apiKey.
 */
export function getAnthropicClientOptions(): ClientOptions {
  const config = getAuthConfig();

  if (config.type === "oauth_token") {
    // OAuth tokens (sk-ant-oat...) use authToken property
    return { authToken: config.token };
  }

  // Regular API keys use apiKey property
  return { apiKey: config.token };
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use getAuthConfig() or getAnthropicClientOptions() instead
 */
export function getAnthropicApiKey(): string {
  return getAuthConfig().token;
}

/**
 * Claude Code keychain credentials structure
 */
interface ClaudeCodeCredentials {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    subscriptionType?: string;
  };
}

/**
 * Read token from macOS Keychain (Claude Code stores credentials there)
 */
function getTokenFromKeychain(): string | null {
  if (process.platform !== "darwin") {
    return null;
  }

  try {
    // Claude Code stores credentials in keychain with service name "Claude Code-credentials"
    const rawCredentials = execSync(
      'security find-generic-password -s "Claude Code-credentials" -w 2>/dev/null',
      { encoding: "utf-8" }
    ).trim();

    if (!rawCredentials || rawCredentials.length === 0) {
      return null;
    }

    // Parse JSON credentials
    const credentials = JSON.parse(rawCredentials) as ClaudeCodeCredentials;

    // Extract access token
    const accessToken = credentials.claudeAiOauth?.accessToken;
    if (accessToken) {
      // Check if token is expired
      const expiresAt = credentials.claudeAiOauth?.expiresAt;
      if (expiresAt && expiresAt < Date.now()) {
        console.warn("⚠️  Claude Code token expired. Please refresh by running Claude Code.");
        // Still return it - the API will handle refresh or error
      }
      return accessToken;
    }
  } catch (error) {
    // Token not found in keychain or invalid JSON
    if (error instanceof SyntaxError) {
      console.warn("⚠️  Invalid credentials format in keychain");
    }
  }

  return null;
}

/**
 * Check which auth method is being used
 */
export function getAuthMethod(): "api_key" | "oauth_token" | "keychain" | "none" {
  if (process.env.ANTHROPIC_API_KEY) {
    return "api_key";
  }
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return "oauth_token";
  }
  try {
    const token = getTokenFromKeychain();
    if (token) {
      return "keychain";
    }
  } catch {
    // Ignore
  }
  return "none";
}
