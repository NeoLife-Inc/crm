"use client";

import { authClient } from "@crm/auth/client";
import { Button } from "@crm/ui/components/button";
import { Input } from "@crm/ui/components/input";
import { Spinner } from "@crm/ui/components/spinner";
import { useState } from "react";
import { toast } from "sonner";

export function MagicLinkSignIn() {
	const [email, setEmail] = useState("");
	const [pending, setPending] = useState(false);
	const [sent, setSent] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!email.trim()) return;

		setPending(true);

		const origin = window.location.origin;

		const { error } = await authClient.signIn.magicLink({
			email: email.trim(),
			callbackURL: `${origin}/`,
		});

		if (error) {
			toast.error(error.message ?? "Could not send magic link.");
			setPending(false);
			return;
		}

		setSent(true);
		setPending(false);
	}

	if (sent) {
		return (
			<div className="flex flex-col gap-3 text-left">
				<p className="text-sm/5 text-muted-foreground">
					We sent a sign-in link to{" "}
					<span className="font-medium text-foreground">{email}</span>.
					Check your inbox and click the link to sign in.
				</p>
				<Button
					variant="link"
					className="h-auto p-0 text-xs text-muted-foreground"
					onClick={() => {
						setSent(false);
						setEmail("");
					}}
				>
					Use a different email
				</Button>
			</div>
		);
	}

	return (
		<form className="flex flex-col gap-3" onSubmit={handleSubmit}>
			<Input
				type="email"
				placeholder="you@company.com"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				disabled={pending}
				autoComplete="email"
				required
			/>
			<Button className="w-full" disabled={pending} type="submit">
				{pending ? <Spinner data-icon="inline-start" /> : null}
				{pending ? "Sending link..." : "Send sign-in link"}
			</Button>
		</form>
	);
}
