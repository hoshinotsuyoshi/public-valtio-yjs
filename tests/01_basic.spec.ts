/* eslint @typescript-eslint/no-explicit-any: "off" */

import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { proxy } from 'valtio/vanilla';
import { bind } from 'valtio-yjs';

describe('bind', () => {
  it('simple map', async () => {
    const doc = new Y.Doc();
    const p = proxy<{ foo?: string }>({});
    const m = doc.getMap('map');

    bind(p, m);
    expect(p.foo).toBe(undefined);

    m.set('foo', 'a');
    expect(p.foo).toBe('a');

    p.foo = 'b';
    await Promise.resolve();
    expect(m.get('foo')).toBe('b');
  });

  it('simple map with initial values', async () => {
    const doc = new Y.Doc();
    const p = proxy<{ foo?: string; bar?: number }>({ foo: 'a' });
    const m = doc.getMap('map');
    m.set('bar', 1);

    bind(p, m);
    expect(p.foo).toBe('a');
    expect(p.bar).toBe(1);
    expect(m.get('foo')).toBe('a');
    expect(m.get('bar')).toBe(1);

    m.set('foo', 'b');
    expect(p.foo).toBe('b');

    p.bar = 2;
    await Promise.resolve();
    expect(m.get('bar')).toBe(2);
  });

  it('simple map with null value', async () => {
    const doc = new Y.Doc();
    const p = proxy<{ foo: string | null }>({
      foo: null,
    });
    const m = doc.getMap('map');
    bind(p, m);

    expect(p.foo).toBe(null);
    expect(m.get('foo')).toBe(null);

    m.set('foo', 'bar');
    expect(p.foo).toBe('bar');
    expect(m.get('foo')).toBe('bar');

    p.foo = null;
    await Promise.resolve();
    expect(p.foo).toBe(null);
    expect(m.get('foo')).toBe(null);
  });

  it('591issue', async () => {
    // https://github.com/yjs/yjs/issues/591
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const updates1: Uint8Array[] = [];
    const updates2: Uint8Array[] = [];
    doc1.on('update', (update) => {
      updates1.push(update);
    });
    doc2.on('update', (update) => {
      updates2.push(update);
    });

    const p1 = proxy<{ x?: number; y?: number }>({});
    const p2 = proxy<{ x?: number; y?: number }>({});

    const m1 = doc1.getMap('map');
    const m2 = doc2.getMap('map');
    bind(p1, m1);
    bind(p2, m2);

    p1.x = 1;
    await Promise.resolve();
    p1.y = 2;
    await Promise.resolve();

    updates1.forEach((u) => {
      Y.applyUpdate(doc2, u as Uint8Array);
    });
    updates1.splice(0);

    expect(p2.x).toBe(1);
    expect(p2.y).toBe(2);

    p1.x = 3;
    await Promise.resolve();
    p1.y = 4;
    await Promise.resolve();

    expect(updates1.length).toBe(2);

    console.warn('updates1', updates1);

    // point: 2番目だけ処理する
    Y.applyUpdate(doc2, updates1[1] as Uint8Array); // これは p2.yにたいしての更新になるはず

    await Promise.resolve();
    expect(p2.x).toBe(1);
    expect(p2.y).toBe(undefined); // パスするのが問題。 2または4になるべき
  });

  it('591issue-2', async () => {
    // https://github.com/yjs/yjs/issues/591
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const updates1: Uint8Array[] = [];
    const updates2: Uint8Array[] = [];
    doc1.on('update', (update) => {
      updates1.push(update);
    });
    doc2.on('update', (update) => {
      updates2.push(update);
    });

    const p1 = proxy<{ x?: number; y?: number }>({});
    const p2 = proxy<{ x?: number; y?: number }>({});

    const m1 = doc1.getMap('map');
    const m2 = doc2.getMap('map');
    bind(p1, m1);
    bind(p2, m2);

    p1.x = 1;
    await Promise.resolve();
    p1.y = 2;
    await Promise.resolve();

    updates1.forEach((u) => {
      Y.applyUpdate(doc2, u as Uint8Array);
    });
    updates1.splice(0);

    expect(p2.x).toBe(1);
    expect(p2.y).toBe(2);

    p1.x = 3;
    await Promise.resolve();
    p1.y = 4;
    await Promise.resolve();

    expect(updates1.length).toBe(2);

    console.warn('updates1', updates1);

    // point: 2番目, 1番目の順に処理する
    Y.applyUpdate(doc2, updates1[1] as Uint8Array); // これは p2.yにたいしての更新になるはず
    Y.applyUpdate(doc2, updates1[0] as Uint8Array); // これは p2.xにたいしての更新になるはず

    await Promise.resolve();
    expect(p2.x).toBe(3); // ok
    expect(p2.y).toBe(4); // ok
  });

  it('591issue-pages', async () => {
    // https://github.com/yjs/yjs/issues/591
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const updates1: Uint8Array[] = [];
    const updates2: Uint8Array[] = [];
    doc1.on('update', (update) => {
      updates1.push(update);
    });
    doc2.on('update', (update) => {
      updates2.push(update);
    });

    type PageContent = string[];
    type Page = { blocks: PageContent };
    type Pages = Record<string, Page>;

    const proxy1 = proxy<Pages>({});
    const proxy2 = proxy<Pages>({});

    const m1 = doc1.getMap('map');
    const m2 = doc2.getMap('map');
    bind(proxy1, m1);
    bind(proxy2, m2);

    proxy1.x = { blocks: ['x1'] };
    await Promise.resolve();
    proxy1.y = { blocks: ['y2'] };
    await Promise.resolve();

    updates1.forEach((u) => {
      Y.applyUpdate(doc2, u as Uint8Array);
    });
    updates1.splice(0);

    expect(proxy2.x).toStrictEqual({ blocks: ['x1'] });
    expect(proxy2.y).toStrictEqual({ blocks: ['y2'] });

    proxy1.x = { blocks: ['x3'] };
    await Promise.resolve();
    proxy1.y = { blocks: ['y4'] };
    await Promise.resolve();

    expect(updates1.length).toBe(2);

    console.warn('updates1', updates1);

    // point: 2番目だけ処理する
    Y.applyUpdate(doc2, updates1[1] as Uint8Array); // これは proxy2.yにたいしての更新になるはず

    await Promise.resolve();
    expect(proxy2.x).toStrictEqual({ blocks: ['x1'] });
    expect(proxy2.y).toBe(undefined); // パスするのが問題。 y2またはy4になるべき

    const keys: string[] = [];
    const values: Page[] = [];
    Object.entries(proxy2).forEach(([k, v]) => {
      keys.push(k);
      values.push(v);
    });
    expect(keys).toStrictEqual(['x']); // yのエントリが消えてしまった...
    expect(values).toStrictEqual([{ blocks: ['x1'] }]);
  });

  it('591issue-pages2', async () => {
    // https://github.com/yjs/yjs/issues/591
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const updates1: Uint8Array[] = [];
    const updates2: Uint8Array[] = [];
    doc1.on('update', (update) => {
      updates1.push(update);
    });
    doc2.on('update', (update) => {
      updates2.push(update);
    });

    type PageContent = string[];
    type Page = { blocks: PageContent };
    type Pages = Record<string, Page>;

    const proxy1 = proxy<Pages>({});
    const proxy2 = proxy<Pages>({});

    const m1 = doc1.getMap('map');
    const m2 = doc2.getMap('map');
    bind(proxy1, m1);
    bind(proxy2, m2);

    proxy1.x = { blocks: ['x1'] };
    await Promise.resolve();
    proxy1.y = { blocks: ['y2'] };
    await Promise.resolve();

    updates1.forEach((u) => {
      Y.applyUpdate(doc2, u as Uint8Array);
    });
    updates1.splice(0);

    expect(proxy2.x).toStrictEqual({ blocks: ['x1'] });
    expect(proxy2.y).toStrictEqual({ blocks: ['y2'] });

    proxy1.x = { blocks: ['x3'] };
    await Promise.resolve();
    proxy1.y = { blocks: ['y4'] };
    await Promise.resolve();

    expect(updates1.length).toBe(2);

    console.warn('updates1', updates1);

    // point: 2番目->1番目と処理する
    Y.applyUpdate(doc2, updates1[1] as Uint8Array); // これは proxy2.yにたいしての更新になるはず
    Y.applyUpdate(doc2, updates1[0] as Uint8Array); // これは proxy2.xにたいしての更新になるはず

    await Promise.resolve();
    expect(proxy2.x).toStrictEqual({ blocks: ['x3'] });
    expect(proxy2.y).toStrictEqual({ blocks: ['y4'] });

    const keys: string[] = [];
    const values: Page[] = [];
    Object.entries(proxy2).forEach(([k, v]) => {
      keys.push(k);
      values.push(v);
    });
    expect(keys).toStrictEqual(['x', 'y']);
    expect(values).toStrictEqual([{ blocks: ['x3'] }, { blocks: ['y4'] }]);
  });

  it('591issue-record', async () => {
    // https://github.com/yjs/yjs/issues/591
    const doc1 = new Y.Doc();
    const doc2 = new Y.Doc();

    const updates1: Uint8Array[] = [];
    const updates2: Uint8Array[] = [];
    doc1.on('update', (update) => {
      updates1.push(update);
    });
    doc2.on('update', (update) => {
      updates2.push(update);
    });

    const p1 = proxy<Record<string, number>>({});
    const p2 = proxy<Record<string, number>>({});

    const m1 = doc1.getMap('map');
    const m2 = doc2.getMap('map');
    bind(p1, m1);
    bind(p2, m2);

    p1.x = 1;
    await Promise.resolve();
    p1.y = 2;
    await Promise.resolve();

    updates1.forEach((u) => {
      Y.applyUpdate(doc2, u as Uint8Array);
    });
    updates1.splice(0);

    expect(p2.x).toBe(1);
    expect(p2.y).toBe(2);

    p1.x = 3;
    await Promise.resolve();
    p1.y = 4;
    await Promise.resolve();

    expect(updates1.length).toBe(2);

    console.warn('updates1', updates1);

    // point: 2番目だけ処理する
    Y.applyUpdate(doc2, updates1[1] as Uint8Array); // これは p2.yにたいしての更新になるはず

    await Promise.resolve();
    expect(p2.x).toBe(1);
    expect(p2.y).toBe(undefined); // パスするのが問題。 2または4になるべき

    const keys: string[] = [];
    const values: number[] = [];
    Object.entries(p2).forEach(([k, v]) => {
      keys.push(k);
      values.push(v);
    });
    expect(keys).toStrictEqual(['x']); // yのエントリが消えてしまった...
    expect(values).toStrictEqual([1]);
  });

  it('nested map (from proxy)', async () => {
    const doc = new Y.Doc();
    const p = proxy<{ foo?: { bar?: string } }>({});
    const m = doc.getMap('map') as any;

    bind(p, m);
    expect(p.foo).toBe(undefined);
    expect(m.get('foo')).toBe(undefined);

    p.foo = { bar: 'a' };
    await Promise.resolve();
    expect(p.foo.bar).toBe('a');
    expect(m.get('foo').get('bar')).toBe('a');

    m.get('foo').set('bar', 'b');
    expect(p.foo.bar).toBe('b');
    expect(m.get('foo').get('bar')).toBe('b');
  });

  it('nested map (from y.map)', async () => {
    const doc = new Y.Doc();
    const p = proxy<{ foo?: { bar?: string } }>({});
    const m = doc.getMap('map') as any;

    bind(p, m);
    expect(p.foo).toBe(undefined);
    expect(m.get('foo')).toBe(undefined);

    m.set('foo', new Y.Map());
    m.get('foo').set('bar', 'a');
    expect(p?.foo?.bar).toBe('a');
    expect(m.get('foo').get('bar')).toBe('a');

    (p as any).foo.bar = 'b';
    await Promise.resolve();
    expect(p?.foo?.bar).toBe('b');
    expect(m.get('foo').get('bar')).toBe('b');
  });

  it('is a single transaction', async () => {
    const doc = new Y.Doc();
    const p = proxy<{ foo?: string; bar?: number }>({ foo: 'a', bar: 5 });
    const m = doc.getMap('map') as any;

    const listener = vi.fn();
    doc.on('update', listener);

    bind(p, m);

    expect(listener).toBeCalledTimes(1);
  });

  it('can unsubscribe', async () => {
    const doc = new Y.Doc();
    const p = proxy<{ foo?: string }>({});
    const m = doc.getMap('map');

    const unsub = bind(p, m);

    unsub();
    expect(p.foo).toBe(undefined);

    m.set('foo', 'a');
    expect(m.get('foo')).toBe('a');
    expect(p.foo).toBe(undefined);

    p.foo = 'b';
    await Promise.resolve();
    expect(m.get('foo')).toBe('a');
    expect(p.foo).toBe('b');
  });
});

describe('bind', () => {
  it('simple array', async () => {
    const doc = new Y.Doc();
    const p = proxy<string[]>([]);
    const a = doc.getArray<string>('arr');

    bind(p, a);
    expect(p).toEqual([]);
    expect(a.toJSON()).toEqual([]);

    a.push(['a']);
    await Promise.resolve();
    expect(a.toJSON()).toEqual(['a']);
    expect(p).toEqual(['a']);

    p.push('b');
    await Promise.resolve();
    expect(p).toEqual(['a', 'b']);
    expect(a.toJSON()).toEqual(['a', 'b']);
  });

  describe('simple array with various operations', () => {
    const doc = new Y.Doc();
    const p = proxy([10, 11, 12, 13]);
    const a = doc.getArray<number>('arr');

    bind(p, a);

    it('a push', async () => {
      a.push([20]);
      await Promise.resolve();
      expect(a.toJSON()).toEqual([10, 11, 12, 13, 20]);
      expect(p).toEqual([10, 11, 12, 13, 20]);
    });

    it('p push', async () => {
      p.push(21);
      await Promise.resolve();
      expect(p).toEqual([10, 11, 12, 13, 20, 21]);
      expect(a.toJSON()).toEqual([10, 11, 12, 13, 20, 21]);
    });

    it('a pop', async () => {
      a.delete(5, 1);
      await Promise.resolve();
      expect(a.toJSON()).toEqual([10, 11, 12, 13, 20]);
      expect(p).toEqual([10, 11, 12, 13, 20]);
    });

    it('p pop', async () => {
      p.pop();
      await Promise.resolve();
      expect(p).toEqual([10, 11, 12, 13]);
      expect(a.toJSON()).toEqual([10, 11, 12, 13]);
    });

    it('a unshift', async () => {
      a.unshift([9]);
      await Promise.resolve();
      expect(a.toJSON()).toEqual([9, 10, 11, 12, 13]);
      expect(p).toEqual([9, 10, 11, 12, 13]);
    });

    it('p unshift', async () => {
      p.unshift(8);
      await Promise.resolve();
      expect(p).toEqual([8, 9, 10, 11, 12, 13]);
      expect(a.toJSON()).toEqual([8, 9, 10, 11, 12, 13]);
    });

    it('a shift', async () => {
      a.delete(0, 1);
      await Promise.resolve();
      expect(a.toJSON()).toEqual([9, 10, 11, 12, 13]);
      expect(p).toEqual([9, 10, 11, 12, 13]);
    });

    it('a shift', async () => {
      p.shift();
      await Promise.resolve();
      expect(p).toEqual([10, 11, 12, 13]);
      expect(a.toJSON()).toEqual([10, 11, 12, 13]);
    });

    it('a replace', async () => {
      doc.transact(() => {
        a.delete(2, 1);
        a.insert(2, [99]);
      });
      await Promise.resolve();
      expect(p).toEqual([10, 11, 99, 13]);
      expect(a.toJSON()).toEqual([10, 11, 99, 13]);
    });

    it('p replace', async () => {
      p[2] = 98;
      await Promise.resolve();
      expect(p).toEqual([10, 11, 98, 13]);
      expect(a.toJSON()).toEqual([10, 11, 98, 13]);
    });

    it('p splice (delete+insert)', async () => {
      p.splice(2, 1, 97);
      await Promise.resolve();
      expect(p).toEqual([10, 11, 97, 13]);
      expect(a.toJSON()).toEqual([10, 11, 97, 13]);
    });

    it('p splice (delete)', async () => {
      p.splice(1, 1);
      await Promise.resolve();
      expect(p).toEqual([10, 97, 13]);
      expect(a.toJSON()).toEqual([10, 97, 13]);
    });

    it('p splice (insert)', async () => {
      p.splice(1, 0, 95, 96);
      await Promise.resolve();
      expect(p).toEqual([10, 95, 96, 97, 13]);
      expect(a.toJSON()).toEqual([10, 95, 96, 97, 13]);
    });
  });
});
