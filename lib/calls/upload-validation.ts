export type UploadKind = "transcript" | "recording";

const RECORDING_EXTENSIONS = new Set(["mp4", "webm", "m4a", "mp3", "wav"]);

export function getUploadExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function resolveUploadKind(fileType: string | null, fileName: string): UploadKind | null {
  const ext = getUploadExtension(fileName);
  if (fileType === "transcript" || ext === "txt") return "transcript";
  if (fileType === "recording" || RECORDING_EXTENSIONS.has(ext)) return "recording";
  return null;
}

export function isRecordingExtension(ext: string): boolean {
  return RECORDING_EXTENSIONS.has(ext.toLowerCase());
}
