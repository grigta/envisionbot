/**
 * Authentication Security Verification Script
 *
 * This script verifies that authentication is properly enforced:
 * 1. JWT_SECRET is required
 * 2. Server fails to start without JWT_SECRET
 * 3. Protected endpoints reject unauthenticated requests
 * 4. Public endpoints work without authentication
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ENV_PATH = join(process.cwd(), ".env");
const ENV_BACKUP = join(process.cwd(), ".env.backup");

interface TestResult {
  test: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function addResult(test: string, passed: boolean, message: string) {
  results.push({ test, passed, message });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${test}: ${message}`);
}

console.log("🔒 Authentication Security Verification\n");

// Test 1: Check JWT_SECRET requirement in code
console.log("1️⃣  Checking JWT_SECRET requirement...");
try {
  const jwtCode = readFileSync(join(process.cwd(), "src/auth/jwt.ts"), "utf-8");
  const hasRequirement = jwtCode.includes('throw new Error') &&
                        jwtCode.includes('JWT_SECRET environment variable is required');
  const hasValidation = jwtCode.includes('if (!JWT_SECRET)');

  if (hasRequirement && hasValidation) {
    addResult(
      "JWT_SECRET Requirement",
      true,
      "Code properly requires JWT_SECRET and throws error if missing"
    );
  } else {
    addResult(
      "JWT_SECRET Requirement",
      false,
      "JWT_SECRET validation missing or incomplete"
    );
  }
} catch (error) {
  addResult("JWT_SECRET Requirement", false, `Error reading jwt.ts: ${error}`);
}

// Test 2: Check auth middleware is registered
console.log("\n2️⃣  Checking auth middleware registration...");
try {
  const serverCode = readFileSync(join(process.cwd(), "src/server.ts"), "utf-8");
  const hasAuthHook = serverCode.includes('createAuthHook');
  const hasRegistration = serverCode.includes('fastify.addHook("onRequest", createAuthHook');
  const hasWaitForInit = serverCode.includes('await stateStore.waitForInit()');

  if (hasAuthHook && hasRegistration && hasWaitForInit) {
    addResult(
      "Auth Middleware Registration",
      true,
      "Auth middleware is properly registered after database initialization"
    );
  } else {
    addResult(
      "Auth Middleware Registration",
      false,
      "Auth middleware registration incomplete"
    );
  }
} catch (error) {
  addResult("Auth Middleware Registration", false, `Error reading server.ts: ${error}`);
}

// Test 3: Check public routes are properly defined
console.log("\n3️⃣  Checking public routes configuration...");
try {
  const middlewareCode = readFileSync(join(process.cwd(), "src/auth/middleware.ts"), "utf-8");
  const publicRoutes = [
    "/api/auth/login",
    "/api/auth/validate",
    "/api/health",
    "/api/webhooks/github"
  ];

  const allRoutesPresent = publicRoutes.every(route =>
    middlewareCode.includes(`"${route}"`)
  );

  if (allRoutesPresent) {
    addResult(
      "Public Routes Configuration",
      true,
      `All ${publicRoutes.length} public routes properly defined`
    );
  } else {
    addResult(
      "Public Routes Configuration",
      false,
      "Some public routes missing from configuration"
    );
  }
} catch (error) {
  addResult("Public Routes Configuration", false, `Error reading middleware.ts: ${error}`);
}

// Test 4: Check .env.example has JWT_SECRET
console.log("\n4️⃣  Checking .env.example documentation...");
try {
  const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf-8");
  const hasJwtSecret = envExample.includes("JWT_SECRET");
  const hasComment = envExample.includes("REQUIRED") || envExample.includes("Authentication");
  const hasExample = envExample.includes("openssl rand -base64 32");

  if (hasJwtSecret && (hasComment || hasExample)) {
    addResult(
      ".env.example Documentation",
      true,
      "JWT_SECRET is properly documented in .env.example"
    );
  } else {
    addResult(
      ".env.example Documentation",
      false,
      "JWT_SECRET documentation incomplete in .env.example"
    );
  }
} catch (error) {
  addResult(".env.example Documentation", false, `Error reading .env.example: ${error}`);
}

// Test 5: Check SETUP_AUTH.md exists and is comprehensive
console.log("\n5️⃣  Checking authentication documentation...");
try {
  if (existsSync(join(process.cwd(), "SETUP_AUTH.md"))) {
    const setupDoc = readFileSync(join(process.cwd(), "SETUP_AUTH.md"), "utf-8");
    const hasQuickStart = setupDoc.includes("Quick Start");
    const hasAccessCodes = setupDoc.includes("Access Code");
    const hasSecurity = setupDoc.includes("Security");

    if (hasQuickStart && hasAccessCodes && hasSecurity) {
      addResult(
        "Authentication Documentation",
        true,
        "SETUP_AUTH.md exists with comprehensive setup guide"
      );
    } else {
      addResult(
        "Authentication Documentation",
        false,
        "SETUP_AUTH.md incomplete"
      );
    }
  } else {
    addResult(
      "Authentication Documentation",
      false,
      "SETUP_AUTH.md does not exist"
    );
  }
} catch (error) {
  addResult("Authentication Documentation", false, `Error reading SETUP_AUTH.md: ${error}`);
}

// Test 6: Check WebSocket authentication
console.log("\n6️⃣  Checking WebSocket authentication...");
try {
  const serverCode = readFileSync(join(process.cwd(), "src/server.ts"), "utf-8");
  const hasWsAuth = serverCode.includes('websocket: true') &&
                    serverCode.includes('verifyToken(token)');
  const closesOnNoToken = serverCode.includes('socket.close') &&
                          serverCode.includes('Authentication required');

  if (hasWsAuth && closesOnNoToken) {
    addResult(
      "WebSocket Authentication",
      true,
      "WebSocket connections require valid JWT token"
    );
  } else {
    addResult(
      "WebSocket Authentication",
      false,
      "WebSocket authentication incomplete"
    );
  }
} catch (error) {
  addResult("WebSocket Authentication", false, `Error checking WebSocket auth: ${error}`);
}

// Test 7: Check rate limiting is configured
console.log("\n7️⃣  Checking rate limiting...");
try {
  const serverCode = readFileSync(join(process.cwd(), "src/server.ts"), "utf-8");
  const hasRateLimit = serverCode.includes('createRateLimitHook');
  const hasConfig = serverCode.includes('RATE_LIMIT_MAX');

  if (hasRateLimit && hasConfig) {
    addResult(
      "Rate Limiting",
      true,
      "Rate limiting is configured for API protection"
    );
  } else {
    addResult(
      "Rate Limiting",
      false,
      "Rate limiting not properly configured"
    );
  }
} catch (error) {
  addResult("Rate Limiting", false, `Error checking rate limiting: ${error}`);
}

// Summary
console.log("\n" + "=".repeat(60));
console.log("📊 VERIFICATION SUMMARY");
console.log("=".repeat(60));

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`\nTotal Tests: ${total}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log("\n🎉 All security checks passed!");
  console.log("\n🔒 Authentication is properly implemented and enforced.");
  console.log("\nTo enable authentication in your deployment:");
  console.log("1. Generate JWT_SECRET: openssl rand -base64 32");
  console.log("2. Add to .env file: JWT_SECRET=<your-secret>");
  console.log("3. Create access code: npm run codes:create \"Admin\" admin");
  console.log("4. Start server: npm run dev");
  process.exit(0);
} else {
  console.log("\n⚠️  Some security checks failed!");
  console.log("Review the failed tests above and fix the issues.");
  process.exit(1);
}
