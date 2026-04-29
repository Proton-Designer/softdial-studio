/**
 * Type declaration for Deno npm: specifier so the IDE resolves the module.
 * At runtime Supabase Edge Functions (Deno) resolve npm:@supabase/supabase-js@2 natively.
 */
declare module "npm:@supabase/supabase-js@2" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type QueryResult<T = any> = { data: T | null; error: { message: string } | null };
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface QueryBuilder {
    eq(column: string, value: unknown): QueryBuilder;
    not(column: string, operator: string, value: unknown): QueryBuilder;
    order(column: string, options?: { ascending?: boolean; referencedTable?: string }): QueryBuilder;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    range(from: number, to: number): Promise<QueryResult<any>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    maybeSingle(): Promise<QueryResult<any>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    single(): Promise<QueryResult<any>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upsert(values: any, options?: { onConflict?: string }): Promise<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update(values: any): {
      eq(column: string, value: unknown): Promise<any>;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    insert(values: any): Promise<any>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface SupabaseClient {
    from(table: string): {
      select(columns?: string): QueryBuilder;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      upsert(values: any, options?: { onConflict?: string }): Promise<any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update(values: any): {
        eq(column: string, value: unknown): Promise<any>;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      insert(values: any): Promise<any>;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>
  ): SupabaseClient;
}
