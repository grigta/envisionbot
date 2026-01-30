/**
 * Authentication composable
 * Manages auth state, login, logout, and token persistence
 */

interface AuthUser {
  name: string;
  role: string;
}

const TOKEN_KEY = "pm_auth_token";
const USER_KEY = "pm_auth_user";
const EXPIRES_KEY = "pm_auth_expires";

export function useAuth() {
  const config = useRuntimeConfig();
  const baseUrl = config.public.apiBaseUrl;

  // Reactive state
  const token = useState<string | null>("auth_token", () => null);
  const user = useState<AuthUser | null>("auth_user", () => null);
  const expiresAt = useState<number | null>("auth_expires", () => null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const isAuthenticated = computed(
    () => !!token.value && (!expiresAt.value || expiresAt.value > Date.now())
  );

  /**
   * Initialize auth state from localStorage (client-side only)
   */
  function initAuth() {
    if (import.meta.client) {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);
      const storedExpires = localStorage.getItem(EXPIRES_KEY);

      if (storedToken && storedExpires) {
        const expires = parseInt(storedExpires, 10);
        if (expires > Date.now()) {
          token.value = storedToken;
          user.value = storedUser ? JSON.parse(storedUser) : null;
          expiresAt.value = expires;
        } else {
          // Token expired, clear storage
          clearAuth();
        }
      }
    }
  }

  /**
   * Save auth state to localStorage
   */
  function saveAuth(authToken: string, authUser: AuthUser, expires: number) {
    token.value = authToken;
    user.value = authUser;
    expiresAt.value = expires;

    if (import.meta.client) {
      localStorage.setItem(TOKEN_KEY, authToken);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));
      localStorage.setItem(EXPIRES_KEY, String(expires));
    }
  }

  /**
   * Clear auth state and localStorage
   */
  function clearAuth() {
    token.value = null;
    user.value = null;
    expiresAt.value = null;

    if (import.meta.client) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(EXPIRES_KEY);
    }
  }

  /**
   * Login with access code
   */
  async function login(code: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const data = await response.json();
        error.value = data.error || "Invalid access code";
        return false;
      }

      const data = await response.json();
      saveAuth(data.token, data.user, data.expiresAt);
      return true;
    } catch (e) {
      error.value = "Network error. Please try again.";
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Logout - revoke token and clear state
   */
  async function logout(): Promise<void> {
    if (token.value) {
      try {
        await fetch(`${baseUrl}/api/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token.value}`,
          },
        });
      } catch {
        // Ignore errors - we're logging out anyway
      }
    }
    clearAuth();
  }

  /**
   * Validate current token with server
   */
  async function validateToken(): Promise<boolean> {
    if (!token.value) return false;

    try {
      const response = await fetch(`${baseUrl}/api/auth/validate`, {
        headers: { Authorization: `Bearer ${token.value}` },
      });

      if (!response.ok) {
        clearAuth();
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  return {
    // State (readonly)
    token: readonly(token),
    user: readonly(user),
    expiresAt: readonly(expiresAt),
    isAuthenticated,
    isLoading,
    error,
    // Methods
    initAuth,
    login,
    logout,
    validateToken,
    clearAuth,
  };
}
