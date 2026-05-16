export interface Env {
  MEDIA_BUCKET: R2Bucket;
  PUBLIC_R2_BASE_URL: string;
  ALLOWED_EXTENSIONS: string;
  WEIGHT_WARNING_BYTES: string;
  MAX_UPLOAD_BYTES: string;
}

export interface R2ObjectMeta {
  key: string;
  size: number;
  uploaded: string;
  contentType: string | null;
}

export interface ListResponse {
  objects: R2ObjectMeta[];
  prefixes: string[];
  cursor: string | null;
  truncated: boolean;
}

export interface UploadResponse {
  key: string;
  url: string;
  size: number;
}

export interface ErrorResponse {
  error: string;
  code: number;
}

export interface TreeResponse {
  prefixes: string[];
}
