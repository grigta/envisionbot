/**
 * Global auth middleware
 * Protects all routes except /login
 */

export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server side
  if (import.meta.server) return;

  const { isAuthenticated, initAuth } = useAuth();

  // Initialize auth state from localStorage
  initAuth();

  // Public routes that don't require auth
  const publicRoutes = ["/login"];
  const isPublicRoute = publicRoutes.includes(to.path);

  if (isPublicRoute) {
    // If already authenticated, redirect to dashboard
    if (isAuthenticated.value) {
      return navigateTo("/");
    }
    return;
  }

  // Protected routes - check authentication
  if (!isAuthenticated.value) {
    return navigateTo("/login");
  }
});
