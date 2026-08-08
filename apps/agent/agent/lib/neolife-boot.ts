// NEOLIFE (CRMA2.2): Boot assertion — verifies the default agent model
// routes through Anthropic, not Z.ai. Logs a warning at startup if the
// default has been overridden to a non-Anthropic provider.
// See README-NEOLIFE.md rebase checklist.

import { DEFAULT_AGENT_MODEL } from "@crm/db/settings";

const REQUIRED_PREFIX = "anthropic/";

export function assertModelRouting(): void {
	const modelId = DEFAULT_AGENT_MODEL.id;

	if (!modelId.startsWith(REQUIRED_PREFIX)) {
		console.warn(
			`[neolife] WARNING: Default agent model is "${modelId}", which does not route through Anthropic. ` +
				"CRM data will be sent to a third-party LLM. " +
				"Set DEFAULT_AGENT_MODEL.id to an anthropic/* model in packages/db/src/settings.ts.",
		);
		return;
	}

	console.info(`[neolife] Agent model routing: ${modelId} (Anthropic) ✓`);
}
