// npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { presignS3Url } from '../../src/features/calls/server/s3-presign.ts'

const aws = {
  method: 'GET',
  endpoint: 'https://s3.amazonaws.com',
  region: 'us-east-1',
  bucket: 'examplebucket',
  key: 'test.txt',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  expiresIn: 86400,
  pathStyle: false,
  now: new Date('2013-05-24T00:00:00Z'),
}

// "Authenticating Requests: Using Query Parameters (AWS Signature Version 4)", example URL.
test('matches the AWS documentation example', () => {
  const url = new URL(presignS3Url(aws))
  assert.equal(url.host, 'examplebucket.s3.amazonaws.com')
  assert.equal(url.pathname, '/test.txt')
  assert.equal(
    url.searchParams.get('X-Amz-Signature'),
    'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
  )
  assert.equal(
    url.searchParams.get('X-Amz-Credential'),
    'AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request',
  )
})

test('path style keeps the bucket in the path and encodes the key', () => {
  const url = new URL(
    presignS3Url({
      ...aws,
      endpoint: 'https://sgp1.digitaloceanspaces.com',
      region: 'sgp1',
      bucket: 'vibely-calls',
      key: 'calls/a b/c.ogg',
      pathStyle: true,
    }),
  )
  assert.equal(url.host, 'sgp1.digitaloceanspaces.com')
  assert.equal(url.pathname, '/vibely-calls/calls/a%20b/c.ogg')
  assert.match(url.searchParams.get('X-Amz-Signature'), /^[0-9a-f]{64}$/)
})

test('DELETE and GET sign differently', () => {
  assert.notEqual(presignS3Url(aws), presignS3Url({ ...aws, method: 'DELETE' }))
})
