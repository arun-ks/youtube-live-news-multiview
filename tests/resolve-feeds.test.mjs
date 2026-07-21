import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSource, normalizeVideo } from '../netlify/functions/resolve-feeds.mjs';

test('parses common YouTube source formats', () => {
  assert.deepEqual(parseSource('https://www.youtube.com/@BBCNews'), { type: 'handle', handle: 'BBCNews' });
  assert.deepEqual(parseSource('https://youtu.be/abcdefghijk'), { type: 'video', videoId: 'abcdefghijk' });
  assert.deepEqual(parseSource('UC1234567890123456789012'), { type: 'channel', channelId: 'UC1234567890123456789012' });
});

test('normalizes live video metadata', () => {
  const value = normalizeVideo({
    id: 'abcdefghijk',
    snippet: { title: 'Live', channelId: 'UCx', channelTitle: 'News', liveBroadcastContent: 'live', thumbnails: {} },
    status: { embeddable: true },
    liveStreamingDetails: { actualStartTime: '2026-07-21T00:00:00Z', concurrentViewers: '123' }
  });
  assert.equal(value.state, 'live');
  assert.equal(value.viewers, 123);
  assert.equal(value.embeddable, true);
});
