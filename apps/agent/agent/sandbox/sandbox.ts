import { defaultBackend, defineSandbox } from "eve/sandbox";
import { neolifeSandboxBackend } from "../lib/neolife-sandbox";

// CRMA2.8: On ARM64 tools box, Vercel Sandbox and microsandbox are unavailable.
// NEOLIFE_SANDBOX_BACKEND env var selects the backend; unset = upstream default.
const _choice = neolifeSandboxBackend();

export default defineSandbox({
	backend: defaultBackend({
		vercel: { networkPolicy: "deny-all" },
		docker: { networkPolicy: "deny-all" },
		microsandbox: { networkPolicy: "deny-all" },
	}),
});
