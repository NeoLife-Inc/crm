import { apiKey } from "@better-auth/api-key";
import { sso } from "@better-auth/sso";
import { db } from "@crm/db";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { magicLink } from "better-auth/plugins/magic-link";
import { organization } from "better-auth/plugins/organization";
import { AUTH_COOKIE_PREFIX } from "./cookies";
import { env } from "./env";
import { ensureWorkspaceMembership } from "./organization";
import {
	GOOGLE_PROVIDER_ID,
	MICROSOFT_PROVIDER_ID,
	MICROSOFT_SYNC_SCOPES,
	SYNC_SCOPES,
} from "./scopes";
import { notifySignedIn } from "./signed-in";
import {
	hasSignInAllowList,
	isWorkspaceEmail,
	primaryWorkspaceDomain,
} from "./workspace";

const socialProviders: NonNullable<BetterAuthOptions["socialProviders"]> = {};

if (env.google) {
	socialProviders.google = {
		...env.google,

		scope: [...SYNC_SCOPES],

		accessType: "offline",

		...(primaryWorkspaceDomain() ? { hd: primaryWorkspaceDomain() } : {}),
	};
}

if (env.microsoft) {
	socialProviders.microsoft = {
		clientId: env.microsoft.clientId,
		clientSecret: env.microsoft.clientSecret,
		tenantId: env.microsoft.tenantId,

		scope: [...MICROSOFT_SYNC_SCOPES],

		prompt: "select_account",

		disableProfilePhoto: true,

		mapProfileToUser: (profile) => ({
			email: profile.email ?? profile.preferred_username ?? profile.upn,
		}),
	};
}

export const auth = betterAuth({
	appName: "CRM",
	baseURL: env.apiUrl,

	database: prismaAdapter(db, {
		provider: "postgresql",
	}),

	emailAndPassword: {
		enabled: false,
	},

	socialProviders,

	account: {
		accountLinking: {
			enabled: true,
			trustedProviders: [GOOGLE_PROVIDER_ID, MICROSOFT_PROVIDER_ID],
		},
	},

	session: {
		expiresIn: 60 * 60 * 24 * 7,
		updateAge: 60 * 60 * 24,
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60,
		},
	},

	rateLimit: {
		enabled: true,
		storage: "database",
	},

	advanced: {
		cookiePrefix: AUTH_COOKIE_PREFIX,

		useSecureCookies: env.isProduction,
		...(env.cookieDomain && {
			crossSubDomainCookies: {
				enabled: true,
				domain: env.cookieDomain,
			},
		}),
	},

	trustedOrigins: [...env.trustedOrigins],
	hooks: {},

	plugins: [
		organization({
			allowUserToCreateOrganization: false,
			disableOrganizationDeletion: true,
			creatorRole: "owner",

			schema: {
				organization: {
					additionalFields: {
						website: {
							type: "string",
							required: false,
						},
					},
				},
			},
		}),

		sso({
			organizationProvisioning: { disabled: true },
		}),

		// NEOLIFE (CRMA2.4): API key plugin for headless auth.
		// Enables Bearer-token sessions for automated agents and MCP tools.
		// Keys are prefixed with `neolife_` and verified via auth.api.verifyApiKey().
		apiKey({
			defaultPrefix: "neolife_",
			rateLimit: {
				enabled: true,
				timeWindow: 60000,
				maxRequests: 100,
			},
		}),

		// NEOLIFE: Magic link plugin — email-based passwordless sign-in.
		// Sends a one-time link to the user's email via Resend.
		// Auto-creates users on first sign-in (subject to ALLOWED_SIGN_IN allow-list).
		magicLink({
			sendMagicLink: async ({ email, url }) => {
				const apiKey = process.env.RESEND_API_KEY;
				const from =
					process.env.RESEND_FROM ??
					"Neolife CRM <hello@neolife.health>";

				if (!apiKey) {
					console.error(
						"[auth] RESEND_API_KEY not set — cannot send magic link email",
					);
					throw new Error("Email service not configured");
				}

				const response = await fetch("https://api.resend.com/emails", {
					method: "POST",
					headers: {
						Authorization: `Bearer ${apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						from,
						to: [email],
						subject: "Sign in to Neolife CRM",
						html: [
							'<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">',
							'<h1 style="font-size:20px;font-weight:600;margin:0 0 16px">Sign in to Neolife CRM</h1>',
							'<p style="color:#666;font-size:14px;margin:0 0 24px">Click the button below to sign in securely. This link expires in 10 minutes.</p>',
							`<a href="${url}" style="display:inline-block;background:#0a0a0a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500">Sign in to Neolife CRM</a>`,
							'<p style="color:#999;font-size:12px;margin:24px 0 0">If you didn\u2019t request this link, you can safely ignore this email.</p>',
							"</div>",
						].join("\n"),
					}),
				});

				if (!response.ok) {
					const text = await response.text().catch(() => "unknown error");
					console.error(
						`[auth] Resend email failed: ${response.status} ${text}`,
					);
					throw new Error("Could not send magic link email");
				}
			},
			expiresIn: 600, // 10 minutes
		}),
	],

	databaseHooks: {
		user: {
			create: {
				before: async (user) => {
					if (!hasSignInAllowList()) {
						throw new APIError("FORBIDDEN", {
							message:
								'No one can sign in yet: set ALLOWED_SIGN_IN in .env to your email domain (for example ALLOWED_SIGN_IN="acme.com") and restart.',
						});
					}

					if (!isWorkspaceEmail(user.email)) {
						const domain = primaryWorkspaceDomain();
						throw new APIError("FORBIDDEN", {
							message: domain
								? `This CRM is private. Sign in with your @${domain} account.`
								: "This CRM is private. That address is not on the allow-list.",
						});
					}

					return { data: user };
				},
			},
		},

		session: {
			create: {
				before: async (session) => {
					const workspaceId = await ensureWorkspaceMembership(session.userId);

					return {
						data: { ...session, activeOrganizationId: workspaceId ?? null },
					};
				},

				after: async (session) => {
					const user = await db.user.findUnique({
						where: { id: session.userId },
						select: { id: true, email: true },
					});

					if (user) await notifySignedIn(user);
				},
			},
		},
	},
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
