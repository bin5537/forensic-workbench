const fs = require('fs')
const crypto = require('crypto')

// Stream a file through multiple digests in a single pass.
function hashFile(filePath, algos = ['sha256', 'md5']) {
  return new Promise((resolve, reject) => {
    const digests = algos.map((a) => ({ a, h: crypto.createHash(a) }))
    const stream = fs.createReadStream(filePath)
    let size = 0
    stream.on('data', (chunk) => {
      size += chunk.length
      for (const d of digests) d.h.update(chunk)
    })
    stream.on('error', reject)
    stream.on('end', () => {
      const out = { size }
      for (const d of digests) out[d.a] = d.h.digest('hex')
      resolve(out)
    })
  })
}

function hashBuffer(buf, algos = ['sha256', 'md5']) {
  const out = { size: buf.length }
  for (const a of algos) out[a] = crypto.createHash(a).update(buf).digest('hex')
  return out
}

module.exports = { hashFile, hashBuffer }
