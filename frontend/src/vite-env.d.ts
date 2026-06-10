/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_ENVIRONMENT_NAME: string;
  readonly VITE_ENVIRONMENT_COLOR: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
