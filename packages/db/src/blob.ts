import { createHash } from "node:crypto";
import { isMirrored } from "./images";
import { safeFetch } from "./safe-fetch";

export { isMirrored, isOptimizable } from "./images";

const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

const ALLOWED: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
	"image/svg+xml": "svg",
	"image/x-icon": "ico",
	"image/vnd.microsoft.icon": "ico",
};

// NEOLIFE (CRMA2.5): S3 configuration. When S3_BUCKET is set, mirror() uses
// S3 instead of @vercel/blob. This is additive — if S3_BUCKET is unset, the
// original Vercel Blob path runs unchanged.
function s3Config() {
	const bucket = process.env.S3_BUCKET;
	if (!bucket) return null;
	return {
		bucket,
		region: process.env.S3_REGION ?? "us-east-1",
		accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
		publicUrl: process.env.S3_PUBLIC_URL ?? `https://${bucket}.s3.${process.env.S3_REGION ?? "us-east-1"}.amazonaws.com`,
		endpoint: process.env.S3_ENDPOINT,
	};
}

export function blobEnabled(): boolean {
	return Boolean(s3Config() || process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export async function mirror(
	sourceUrl: string,
	prefix: string,
): Promise<string | null> {
	if (!blobEnabled()) return null;
	if (isMirrored(sourceUrl)) return sourceUrl;

	try {
		const result = await safeFetch(sourceUrl, { timeoutMs: TIMEOUT_MS });
		if (!result?.response.ok) return null;

		const { response } = result;
		const type = response.headers.get("content-type")?.split(";")[0]?.trim();
		const extension = type ? ALLOWED[type.toLowerCase()] : undefined;
		if (!type || !extension) return null;

		const bytes = await readCapped(response);
		if (!bytes) return null;

		const digest = createHash("sha256")
			.update(bytes)
			.digest("hex")
			.slice(0, 12);

		const key = `${prefix}-${digest}.${extension}`;

		// NEOLIFE (CRMA2.5): Prefer S3 when configured; fall back to Vercel Blob.
		const cfg = s3Config();
		if (cfg) {
			return await uploadToS3(cfg, key, bytes, type);
		}

		const { put } = await import("@vercel/blob");

		const blob = await put(key, bytes, {
			access: "public",
			contentType: type,
			addRandomSuffix: false,
			allowOverwrite: true,
		});

		return blob.url;
	} catch {
		return null;
	}
}

// NEOLIFE (CRMA2.5): S3 upload helper.
async function uploadToS3(
	cfg: NonNullable<ReturnType<typeof s3Config>>,
	key: string,
	bytes: Buffer,
	contentType: string,
): Promise<string> {
	const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

	const client = new S3Client({
		region: cfg.region,
		credentials: {
			accessKeyId: cfg.accessKeyId,
			secretAccessKey: cfg.secretAccessKey,
		},
		...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
	});

	await client.send(
		new PutObjectCommand({
			Bucket: cfg.bucket,
			Key: key,
			Body: bytes,
			ContentType: contentType,
			ACL: "public-read",
		}),
	);

	return `${cfg.publicUrl}/${key}`;
}

async function readCapped(response: Response): Promise<Buffer | null> {
	const declared = Number(response.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > MAX_BYTES) {
		await response.body?.cancel();
		return null;
	}

	if (!response.body) return null;

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;

	try {
		while (size <= MAX_BYTES) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			chunks.push(value);
		}
	} catch {
		return null;
	} finally {
		await reader.cancel().catch(() => {});
	}

	if (size === 0 || size > MAX_BYTES) return null;
	return Buffer.concat(chunks);
}
