// Quick test script
import http from 'node:http'

const PORT = 12470

function request(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${path}`, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    }).on('error', reject)
  })
}

async function main() {
  console.log('Testing SRAMO server...')
  
  const tests = [
    ['GET /api/addons', '/api/addons'],
    ['GET /api/settings', '/api/settings'],
    ['GET /api/library', '/api/library'],
    ['GET /api/history', '/api/history'],
    ['GET /addon/org.sramo.builtin/manifest.json', '/addon/org.sramo.builtin/manifest.json'],
  ]

  for (const [name, path] of tests) {
    try {
      const result = await request(path)
      console.log(`${result.status === 200 ? '✓' : '✗'} ${name} => ${result.status}`)
      if (result.status !== 200) {
        console.log(`  Body: ${result.body || '(empty)'}`)
      }
    } catch (err) {
      console.log(`✗ ${name} => Error: ${err.message}`)
    }
  }
}

main()
