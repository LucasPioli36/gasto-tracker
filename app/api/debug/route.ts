export async function GET() {
  return Response.json({
    supabaseUrl: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET',
    hasSupabaseKey: !!process.env.SUPABASE_SERVICE_KEY,
    sessionSecretLength: process.env.SESSION_SECRET?.length ?? 0,
    nodeEnv: process.env.NODE_ENV,
  })
}
