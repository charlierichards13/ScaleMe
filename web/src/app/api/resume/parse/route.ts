import { createUploadHandler } from "@/lib/resume/server/upload";

// Default Node runtime; explicit runtime flags conflict with this app's cacheComponents.
export const POST = createUploadHandler();
