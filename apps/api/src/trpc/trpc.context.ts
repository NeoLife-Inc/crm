import { auth, type Session } from "@crm/auth";
import { db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import type { ContextOptions, TRPCContext } from "nestjs-trpc";
import type { BaseTrpcContext } from "./context.types";

@Injectable()
export class TrpcContext implements TRPCContext {
	async create(opts: ContextOptions): Promise<BaseTrpcContext> {
		const req = "req" in opts ? opts.req : undefined;
		let session = req
			? await auth.api
					.getSession({ headers: fromNodeHeaders(req.headers) })
					.catch(() => null)
			: null;

		// NEOLIFE (CRMA2.4): Fall back to API key when no cookie session.
		// When the Better Auth apiKey plugin is loaded, getSession() should
		// already resolve Bearer tokens. This fallback handles edge cases
		// where the plugin's session resolution doesn't fire.
		if (!session && req) {
			const authHeader = req.headers.authorization;
			if (authHeader?.startsWith("Bearer ")) {
				const key = authHeader.slice(7);
				const result = await auth.api
					.verifyApiKey({ body: { key } })
					.catch(() => null);
			if (result?.valid && result.key?.referenceId) {
				const user = await db.user.findUnique({
					where: { id: result.key.referenceId },
						select: {
							id: true,
							email: true,
							name: true,
							image: true,
							emailVerified: true,
						},
					});
					if (user) {
						session = {
							user,
							session: {
								userId: user.id,
								expiresAt: new Date(Date.now() + 3600_000),
							},
						} as Session;
					}
				}
			}
		}

		return { req, session };
	}
}
