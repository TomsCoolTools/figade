// A small stand-in for Cloudflare D1 on top of Node's built-in SQLite, used
// by the dev server and the Worker tests. Implements the parts of the D1 API
// the handler uses: prepare().bind().first() / all() / run(), and exec().

import { DatabaseSync } from 'node:sqlite';

export function createD1(file = ':memory:') {
  const db = new DatabaseSync(file);
  const statement = (sql, params = []) => ({
    bind: (...p) => statement(sql, p),
    async first() {
      return db.prepare(sql).get(...params) ?? null;
    },
    async all() {
      return { results: db.prepare(sql).all(...params) };
    },
    async run() {
      const r = db.prepare(sql).run(...params);
      return { success: true, meta: { changes: Number(r.changes) } };
    },
  });
  return {
    prepare: (sql) => statement(sql),
    async exec(sql) {
      db.exec(sql);
    },
    raw: db,
  };
}
