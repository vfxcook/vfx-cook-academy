interface ImportMetaEnv {
  /** Absolute API origin when the API is not served from this origin's /api (e.g. no Worker proxy). */
  readonly VITE_API_BASE?: string;
  /** Overrides the Google client ID the server reports. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
