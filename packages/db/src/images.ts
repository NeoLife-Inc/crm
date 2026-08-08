export const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

// NEOLIFE (CRMA2.5): S3 mirror host suffix, configurable via env.
export const S3_MIRROR_HOST_SUFFIX =
	process.env.S3_PUBLIC_URL
		? (() => {
				try {
					return `.${new URL(process.env.S3_PUBLIC_URL).hostname}`;
				} catch {
					return ".amazonaws.com";
				}
			})()
		: ".amazonaws.com";

export const COMPANY_IMAGE_FIELDS = [
	"logoUrl",
	"logoDarkUrl",
	"iconUrl",
	"iconDarkUrl",
] as const;

export type CompanyImageField = (typeof COMPANY_IMAGE_FIELDS)[number];

const OPTIMIZABLE = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);

export function isMirrored(url: string | null | undefined): boolean {
	if (!url) return false;
	try {
		const hostname = new URL(url).hostname;
		return hostname.endsWith(BLOB_HOST_SUFFIX) || hostname.endsWith(S3_MIRROR_HOST_SUFFIX);
	} catch {
		return false;
	}
}

export function isOptimizable(url: string | null | undefined): boolean {
	if (!isMirrored(url) || !url) return false;

	try {
		const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
		return extension !== undefined && OPTIMIZABLE.has(extension);
	} catch {
		return false;
	}
}
