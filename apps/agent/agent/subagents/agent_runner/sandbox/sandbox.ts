import { defaultBackend, defineSandbox } from "eve/sandbox";
import { neolifeSandboxBackend } from "../../../lib/neolife-sandbox";

const _choice = neolifeSandboxBackend();

export default defineSandbox({
	backend: defaultBackend({
		vercel: { networkPolicy: "deny-all" },
		docker: { networkPolicy: "deny-all" },
		microsandbox: { networkPolicy: "deny-all" },
	}),
});
