/**
 * NEOLIFE (CRMA2.4): Mint an API key for headless auth.
 *
 * Usage:
 *   bun scripts/mint-api-key.ts <email> [name]
 *
 * The key is prefixed with `neolife_` and can be used as:
 *   Authorization: Bearer neolife_<...>
 *
 * against any tRPC endpoint or Better Auth endpoint that accepts API key sessions.
 */
import { auth } from "@crm/auth";
import { db } from "@crm/db";

const email = process.argv[2];
const name = process.argv[3] ?? `headless-${Date.now()}`;

if (!email) {
	console.error("Usage: bun scripts/mint-api-key.ts <email> [name]");
	process.exit(1);
}

if (process.env.NODE_ENV === "production" && !process.env.CRM_ALLOW_MINT_PROD) {
	console.error(
		"Refusing to mint API key in production. Set CRM_ALLOW_MINT_PROD=1 to override.",
	);
	process.exit(1);
}

const user = await db.user.findUnique({
	where: { email },
	select: { id: true, email: true, name: true },
});

if (!user) {
	console.error(`User not found: ${email}`);
	process.exit(1);
}

const result = await auth.api.createApiKey({
	body: {
		userId: user.id,
		name,
		prefix: "neolife_",
	},
});

if (!result || !("key" in result)) {
	console.error("Failed to create API key — unexpected response:", result);
	process.exit(1);
}

console.log(result.key as string);

await db.$disconnect();
