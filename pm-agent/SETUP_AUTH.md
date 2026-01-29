# Authentication Setup Guide

## Overview

Envision CEO uses JWT-based authentication with access codes to secure the web panel. All API endpoints (except public auth routes) require a valid authentication token.

## Quick Start

### 1. Generate JWT Secret

Generate a secure random secret for signing JWT tokens:

```bash
# Using openssl (recommended)
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Configure Environment

Add the generated secret to your `.env` file:

```bash
# Copy example file
cp .env.example .env

# Edit .env and add your JWT secret
JWT_SECRET=your-generated-secret-here
JWT_EXPIRES_IN=7d  # Optional: Token expiration (default: 7 days)
```

**⚠️ Security Warning:** Never commit `.env` to version control. The JWT_SECRET must be kept secret.

### 3. Create Initial Access Code

Access codes are used to log into the web panel. Create your first admin code:

```bash
# Navigate to pm-agent directory
cd pm-agent

# Install dependencies (if not done)
npm install

# Build the project (if not done)
npm run build

# Create an admin access code
npx tsx src/scripts/manage-codes.ts create "Admin" admin
```

This will output something like:
```
Access code created successfully!

Name: Admin
Role: admin
Code: ABCD-EFGH-IJKL

Save this code securely - it cannot be retrieved later.
```

**📝 Important:** Save this access code immediately. It's shown only once and cannot be retrieved later (only stored as a bcrypt hash).

### 4. Start the Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 5. Log Into Web Panel

1. Open the web panel (default: http://localhost:3000)
2. You'll be redirected to the login page
3. Enter your access code (format: XXXX-XXXX-XXXX)
4. Click "Access Panel"

After successful login, you'll receive a JWT token that's stored in your browser's localStorage. The token will automatically be sent with all API requests.

## Access Code Management

### List All Access Codes

```bash
npx tsx src/scripts/manage-codes.ts list
```

Example output:
```
Access Codes:

ID                              | Name          | Role     | Active | Last Used
-------------------------------------------------------------------------------------------
ac-1234567890-abc123           | Admin         | admin    | Yes    | 2026-01-29 10:30:00
ac-1234567890-def456           | Developer     | user     | Yes    | Never
ac-1234567890-ghi789           | Viewer        | readonly | No     | 2026-01-28 15:45:00
```

### Create Additional Access Codes

```bash
# Create admin access code
npx tsx src/scripts/manage-codes.ts create "Admin Name" admin

# Create regular user
npx tsx src/scripts/manage-codes.ts create "Developer Name" user

# Create read-only access
npx tsx src/scripts/manage-codes.ts create "Viewer Name" readonly
```

### Deactivate Access Code

```bash
npx tsx src/scripts/manage-codes.ts deactivate ac-1234567890-abc123
```

Deactivating an access code will:
- Prevent new logins with that code
- Existing sessions with that code remain valid until they expire
- To immediately revoke all sessions, users must manually log out

## Roles and Permissions

| Role | Permissions |
|------|-------------|
| `admin` | Full access to all features, can approve actions, modify projects |
| `user` | Can view and interact with projects, tasks, and reports |
| `readonly` | View-only access (future implementation) |

**Note:** Currently, role-based access control is not fully implemented. All authenticated users have full access. This will be enhanced in future versions.

## Token Lifecycle

### Token Expiration

Tokens expire after the configured period (default: 7 days). Users will need to log in again after expiration.

### Manual Logout

Users can log out manually from the web panel, which:
1. Revokes the token on the server (added to revoked tokens table)
2. Clears localStorage in the browser
3. Redirects to login page

### Token Validation

The server validates tokens on every request:
1. Checks JWT signature and expiration
2. Verifies token hasn't been revoked
3. Ensures the access code is still active

## Security Best Practices

### 1. JWT Secret Management

- ✅ Use a strong, random secret (at least 32 characters)
- ✅ Keep `JWT_SECRET` in `.env` (never in code or version control)
- ✅ Use different secrets for dev/staging/production
- ✅ Rotate secrets periodically (requires re-login for all users)

### 2. Access Code Distribution

- ✅ Share access codes through secure channels (encrypted messaging)
- ✅ Don't send codes via email or public chat
- ✅ Create unique codes per user
- ✅ Deactivate codes when team members leave

### 3. Network Security

- ✅ Use HTTPS in production (required for secure token transmission)
- ✅ Configure proper CORS settings
- ✅ Place behind a firewall or VPN if possible
- ✅ Use a reverse proxy (nginx/caddy) with rate limiting

### 4. Regular Maintenance

- ✅ Review active access codes regularly
- ✅ Monitor login attempts (check auth_sessions table)
- ✅ Clean up expired sessions periodically
- ✅ Audit user access and roles

## Troubleshooting

### "JWT_SECRET environment variable is required"

**Cause:** JWT_SECRET is not set in your .env file.

**Solution:**
1. Generate a secret: `openssl rand -base64 32`
2. Add to `.env`: `JWT_SECRET=your-secret-here`
3. Restart the server

### "Invalid access code"

**Possible causes:**
- Access code was typed incorrectly (check for typos)
- Access code has been deactivated
- Access code has expired (if expiration was set)

**Solution:**
- Double-check the code format: XXXX-XXXX-XXXX
- Verify the code is active: `npx tsx src/scripts/manage-codes.ts list`
- Create a new code if needed

### "Token has been revoked"

**Cause:** Token was manually revoked (user logged out) but is still in localStorage.

**Solution:**
- Clear browser localStorage or use incognito mode
- Log in again with your access code

### "Failed to initialize database"

**Cause:** Database initialization failed, preventing auth system from starting.

**Solution:**
1. Check `data/` directory permissions
2. Ensure SQLite can create database files
3. Check logs for specific database errors

## Database Schema

Authentication uses these tables:

### `access_codes`
- `id` - Unique identifier
- `code_hash` - Bcrypt hash of the access code
- `name` - Display name for the code owner
- `role` - User role (admin/user/readonly)
- `is_active` - Whether code can be used
- `created_at` - Creation timestamp
- `expires_at` - Optional expiration timestamp
- `last_used_at` - Last successful login

### `auth_sessions`
- `id` - Unique identifier
- `access_code_id` - Reference to access code
- `token_jti` - JWT ID (for revocation)
- `ip_address` - IP address of login
- `user_agent` - Browser user agent
- `created_at` - Session creation time
- `expires_at` - Token expiration time
- `revoked_at` - Manual revocation time (logout)

## Advanced Configuration

### Custom Token Expiration

```env
JWT_EXPIRES_IN=30d  # 30 days
JWT_EXPIRES_IN=24h  # 24 hours
JWT_EXPIRES_IN=90m  # 90 minutes
```

### Session Cleanup

Expired sessions can be cleaned up periodically:

```typescript
// In your maintenance script
const authRepo = new AuthRepository(deps);
const cleaned = authRepo.cleanupExpiredSessions();
console.log(`Cleaned up ${cleaned} expired sessions`);
```

### WebSocket Authentication

WebSocket connections (`/ws/live`) are currently not authenticated. This is being addressed in future updates. For now:

- ✅ Ensure WebSocket endpoint is not exposed publicly
- ✅ Use a firewall to restrict access
- ✅ Consider using SSH tunnel or VPN

## Migration from Unauthenticated Setup

If you're upgrading from a version without authentication:

1. **Backup your data directory**
   ```bash
   cp -r data/ data.backup/
   ```

2. **Set JWT_SECRET**
   ```bash
   echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env
   ```

3. **Create initial access code**
   ```bash
   npx tsx src/scripts/manage-codes.ts create "Admin" admin
   ```

4. **Restart the server**
   ```bash
   npm restart
   ```

5. **Update any API clients**
   - Add authentication header: `Authorization: Bearer <token>`
   - Implement login flow to obtain token

## Support

For issues or questions:
- Check the [main README](README.md) for general setup
- Review server logs for detailed error messages
- File an issue on GitHub with authentication-related problems

## Future Enhancements

Planned authentication improvements:

- [ ] OAuth2/OIDC integration (Google, GitHub, etc.)
- [ ] Role-based access control (RBAC) enforcement
- [ ] Two-factor authentication (2FA)
- [ ] API key authentication for programmatic access
- [ ] WebSocket authentication
- [ ] Session management UI in web panel
- [ ] Password-based login option
- [ ] LDAP/SSO integration
