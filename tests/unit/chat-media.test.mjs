// npm run test:unit (Node strips the TypeScript types natively).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDuration,
  nextRate,
  pickRecorderMime,
  storedFormat,
  toWaveform,
} from '../../src/features/chat/media.ts'

test('recorder MIME: Opus/WebM voice on Chrome, MP4 on iOS Safari', () => {
  const chrome = (t) => t.startsWith('audio/webm') || t.startsWith('video/webm')
  const safari = (t) => t.startsWith('audio/mp4') || t.startsWith('video/mp4')
  assert.equal(pickRecorderMime('voice', chrome), 'audio/webm;codecs=opus')
  assert.equal(pickRecorderMime('voice', safari), 'audio/mp4;codecs=mp4a.40.2')
  assert.equal(pickRecorderMime('video', chrome), 'video/webm;codecs=vp9,opus')
  assert.equal(pickRecorderMime('video', safari), 'video/mp4;codecs=avc1.42E01E,mp4a.40.2')
  assert.equal(
    pickRecorderMime('voice', () => false),
    null,
  )
})

test('stored format strips codecs and maps the extension', () => {
  assert.deepEqual(storedFormat('voice', 'audio/webm;codecs=opus'), {
    mime: 'audio/webm',
    ext: 'webm',
  })
  assert.deepEqual(storedFormat('voice', 'audio/mp4'), { mime: 'audio/mp4', ext: 'm4a' })
  // Some browsers report a video/* container for audio-only recordings.
  assert.deepEqual(storedFormat('voice', 'video/webm'), { mime: 'audio/webm', ext: 'webm' })
  assert.deepEqual(storedFormat('video', 'video/mp4;codecs=avc1'), {
    mime: 'video/mp4',
    ext: 'mp4',
  })
  assert.equal(storedFormat('video', 'video/x-matroska'), null)
})

test('waveform: fixed number of peaks, normalised to 0..100', () => {
  const w = toWaveform([0, 0.1, 0.5, 0.2, 0.05, 0.4], 3)
  assert.deepEqual(w, [20, 100, 80])
  assert.equal(toWaveform(Array.from({ length: 500 }, (_, i) => i % 7)).length, 48)
  assert.deepEqual(toWaveform([0, 0], 2), [0, 0])
  assert.deepEqual(toWaveform([]), [])
  // Fewer samples than peaks still yields `count` values.
  assert.equal(toWaveform([1, 2], 48).length, 48)
})

test('duration and playback speed', () => {
  assert.equal(formatDuration(7_400), '0:07')
  assert.equal(formatDuration(119_600), '2:00')
  assert.equal(formatDuration(-5), '0:00')
  assert.equal(nextRate(1), 1.5)
  assert.equal(nextRate(1.5), 2)
  assert.equal(nextRate(2), 1)
})
