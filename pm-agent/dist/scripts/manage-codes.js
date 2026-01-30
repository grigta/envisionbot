#!/usr/bin/env npx tsx
/**
 * CLI script for managing access codes
 *
 * Usage:
 *   npx tsx src/scripts/manage-codes.ts create [name] [role]
 *   npx tsx src/scripts/manage-codes.ts list
 *   npx tsx src/scripts/manage-codes.ts deactivate [id]
 */
import { initDatabase } from "../db/index.js";
import { AuthRepository } from "../repositories/auth.repository.js";
import { generateAccessCode } from "../auth/access-code.js";
const DATA_DIR = process.env.DATA_DIR || "./data";
async function main() {
    const command = process.argv[2];
    if (!command) {
        console.log(`
Access Code Management CLI

Commands:
  create [name] [role]  - Create a new access code
                          name: Display name (default: "Admin")
                          role: admin | user | readonly (default: "admin")
  list                  - List all access codes
  deactivate [id]       - Deactivate an access code

Examples:
  npx tsx src/scripts/manage-codes.ts create
  npx tsx src/scripts/manage-codes.ts create "Developer" user
  npx tsx src/scripts/manage-codes.ts list
  npx tsx src/scripts/manage-codes.ts deactivate ac-1234567890-abc123
    `);
        process.exit(0);
    }
    // Initialize database
    const db = await initDatabase({ dataDir: DATA_DIR });
    const authRepo = new AuthRepository({
        db: db.sqlite,
        cache: db.cache,
        pubsub: db.pubsub,
    });
    try {
        switch (command) {
            case "create": {
                const name = process.argv[3] || "Admin";
                const role = (process.argv[4] || "admin");
                if (!["admin", "user", "readonly"].includes(role)) {
                    console.error("Invalid role. Must be: admin, user, or readonly");
                    process.exit(1);
                }
                const code = generateAccessCode();
                await authRepo.createCode(name, role, code);
                console.log(`
Access code created successfully!

Name: ${name}
Role: ${role}
Code: ${code}

Save this code securely - it cannot be retrieved later.
        `);
                break;
            }
            case "list": {
                const codes = authRepo.getAll();
                if (codes.length === 0) {
                    console.log("No access codes found.");
                }
                else {
                    console.log("\nAccess Codes:\n");
                    console.log("ID                              | Name          | Role     | Active | Last Used");
                    console.log("-".repeat(90));
                    for (const code of codes) {
                        const lastUsed = code.lastUsedAt
                            ? new Date(code.lastUsedAt).toLocaleString()
                            : "Never";
                        console.log(`${code.id.padEnd(31)} | ${code.name.padEnd(13)} | ${code.role.padEnd(8)} | ${code.isActive ? "Yes" : "No "}    | ${lastUsed}`);
                    }
                    console.log();
                }
                break;
            }
            case "deactivate": {
                const id = process.argv[3];
                if (!id) {
                    console.error("Please provide the access code ID to deactivate");
                    process.exit(1);
                }
                const success = await authRepo.deactivateCode(id);
                if (success) {
                    console.log(`Access code ${id} has been deactivated.`);
                }
                else {
                    console.log(`Access code ${id} not found.`);
                }
                break;
            }
            default:
                console.error(`Unknown command: ${command}`);
                process.exit(1);
        }
    }
    finally {
        await db.close();
    }
}
main().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
});
//# sourceMappingURL=manage-codes.js.map