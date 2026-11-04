/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" to use the local Firebase emulators (see .env.development). */
  readonly VITE_USE_EMULATORS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
