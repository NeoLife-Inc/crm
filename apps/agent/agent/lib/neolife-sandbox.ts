/**
 * NEOLIFE (CRMA2.8): ARM64 sandbox backend selection.
 *
 * On the tools box (t4g Nitro, ARM64):
 * - Vercel Sandbox: unavailable (needs Vercel deployment)
 * - microsandbox: impossible (needs KVM, not available on Nitro)
 * - Docker: available if the eve image supports ARM64
 * - just-bash: always available (no container)
 *
 * Set `NEOLIFE_SANDBOX_BACKEND=docker` to force Docker.
 * Set `NEOLIFE_SANDBOX_BACKEND=bash` to force just-bash (no container).
 * Unset → upstream defaultBackend() auto-selection runs unchanged.
 *
 * Verification: run `apps/agent/scripts/check-sandbox.sh` on the tools box.
 */

export type SandboxBackendChoice = "docker" | "bash" | "default";

export function neolifeSandboxBackend(): SandboxBackendChoice {
	const v = process.env.NEOLIFE_SANDBOX_BACKEND;
	if (v === "docker") return "docker";
	if (v === "bash") return "bash";
	return "default";
}
