import { describe, it, expect, vi } from 'vitest';
import { Page } from '../src';

describe('Page pagination and async iteration', () => {
  it('supports accessing page properties', () => {
    const page = new Page({
      results: [1, 2, 3],
      has_more: true,
      next_cursor: 'cur_1',
      request_id: 'req_1',
      metadata: { custom: 'value' },
    });

    expect(page.results).toEqual([1, 2, 3]);
    expect(page.hasMore).toBe(true);
    expect(page.has_more).toBe(true);
    expect(page.nextCursor).toBe('cur_1');
    expect(page.next_cursor).toBe('cur_1');
    expect(page.requestId).toBe('req_1');
    expect(page.request_id).toBe('req_1');
    expect(page.metadata).toEqual({ custom: 'value' });
    expect(page.length).toBe(3);
    expect(page.get(1)).toBe(2);
  });

  it('supports async iteration across multiple pages', async () => {
    const fetchNext = vi.fn(async (cursor: string) => {
      if (cursor === 'cur_1') {
        return new Page({
          results: [4, 5],
          has_more: true,
          next_cursor: 'cur_2',
          fetchNext,
        });
      }
      return new Page({
        results: [6],
        has_more: false,
        next_cursor: null,
      });
    });

    const firstPage = new Page({
      results: [1, 2, 3],
      has_more: true,
      next_cursor: 'cur_1',
      fetchNext,
    });

    const collected: number[] = [];
    for await (const item of firstPage) {
      collected.push(item);
    }

    expect(collected).toEqual([1, 2, 3, 4, 5, 6]);
    expect(fetchNext).toHaveBeenCalledTimes(2);
  });

  it('supports autoPagingIter() and auto_paging_iter()', async () => {
    const fetchNext = vi.fn(async (cursor: string) => {
      return new Page({
        results: ['b'],
        has_more: false,
        next_cursor: null,
      });
    });

    const firstPage = new Page({
      results: ['a'],
      has_more: true,
      next_cursor: 'c1',
      fetchNext,
    });

    const collected: string[] = [];
    for await (const item of firstPage.autoPagingIter()) {
      collected.push(item);
    }

    expect(collected).toEqual(['a', 'b']);
  });
});
