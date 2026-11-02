import http from 'node:http'

// Local-only path adapter for the Supabase client's /rest/v1 prefix.
// Queries and authorization are handled by the real PostgREST server.
const server = http.createServer((request, response) => {
  if (!request.url?.startsWith('/rest/v1')) {
    response.writeHead(404).end()
    return
  }
  const upstream = http.request({
    hostname: '127.0.0.1', port: 54741,
    path: request.url.slice('/rest/v1'.length) || '/',
    method: request.method, headers: request.headers,
  }, incoming => {
    response.writeHead(incoming.statusCode ?? 502, incoming.headers)
    incoming.pipe(response)
  })
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'application/json' })
    response.end('{"error":"Local validation API unavailable"}')
  })
  request.pipe(upstream)
})

server.listen(54742, '127.0.0.1', () => console.log('Validation REST adapter listening on loopback port 54742.'))
