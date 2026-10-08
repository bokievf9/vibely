// AWS Signature V4 query-string signing ("presigned URL") for S3-compatible storage such as
// DigitalOcean Spaces. Dependency-free (node:crypto only, no server-only import) so it is
// unit-tested with `node --test` against the AWS documentation example (tests/unit/s3-presign).
import { createHash, createHmac } from 'node:crypto'

export type PresignInput = {
  method: 'GET' | 'DELETE'
  endpoint: string
  region: string
  bucket: string
  key: string
  accessKeyId: string
  secretAccessKey: string
  expiresIn: number
  // true: https://endpoint/bucket/key; false: https://bucket.endpoint/key
  pathStyle: boolean
  now?: Date
}

// RFC 3986 encoding as S3 expects it (encodeURIComponent leaves !'()* alone).
const encode = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )

const hmac = (key: string | Buffer, data: string) => createHmac('sha256', key).update(data).digest()
const sha256 = (data: string) => createHash('sha256').update(data).digest('hex')

const amzDate = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

export function presignS3Url(input: PresignInput): string {
  const base = new URL(input.endpoint)
  const prefix = base.pathname.replace(/\/+$/, '')
  const host = input.pathStyle ? base.host : `${input.bucket}.${base.host}`
  const key = input.key.split('/').map(encode).join('/')
  const path = input.pathStyle ? `${prefix}/${encode(input.bucket)}/${key}` : `${prefix}/${key}`

  const stamp = amzDate(input.now ?? new Date())
  const day = stamp.slice(0, 8)
  const scope = `${day}/${input.region}/s3/aws4_request`
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${input.accessKeyId}/${scope}`],
    ['X-Amz-Date', stamp],
    ['X-Amz-Expires', String(Math.round(input.expiresIn))],
    ['X-Amz-SignedHeaders', 'host'],
  ]
    .map(([k = '', v = '']) => `${encode(k)}=${encode(v)}`)
    .join('&')

  const canonical = [
    input.method,
    path,
    query,
    `host:${host}`,
    '',
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, sha256(canonical)].join('\n')
  const signingKey = ['s3', 'aws4_request'].reduce(
    (k, part) => hmac(k, part),
    hmac(hmac(`AWS4${input.secretAccessKey}`, day), input.region),
  )
  const signature = createHmac('sha256', signingKey).update(toSign).digest('hex')
  return `${base.protocol}//${host}${path}?${query}&X-Amz-Signature=${signature}`
}
