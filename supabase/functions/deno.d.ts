/**
 * Deno global type declarations for Supabase Edge Functions.
 * Supabase Edge Functions run on Deno runtime which provides these globals.
 */
declare namespace Deno {
  export namespace env {
    export function get(key: string): string | undefined;
  }
}

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};
