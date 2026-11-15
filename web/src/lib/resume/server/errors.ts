export type ParseCode = "INVALID_FILE_TYPE" | "FILE_TOO_LARGE" | "NO_EXTRACTABLE_TEXT" | "PARSING_FAILED";

export class UploadError extends Error {
  constructor(readonly status: number, readonly code: ParseCode, message: string) {
    super(message);
  }
}

export const unavailable = () => new UploadError(503, "PARSING_FAILED", "Private resume uploads are unavailable on this server.");
export const failed = () => new UploadError(502, "PARSING_FAILED", "The PDF could not be processed.");
export const timedOut = () => new UploadError(504, "PARSING_FAILED", "The PDF took too long to process.");
export const aborted = () => new UploadError(408, "PARSING_FAILED", "The upload was interrupted or took too long.");
export const tooLarge = () => new UploadError(413, "FILE_TOO_LARGE", "Upload a PDF no larger than 5 MiB.");
export const invalid = () => new UploadError(415, "INVALID_FILE_TYPE", "Choose one nonempty text-based PDF resume.");
