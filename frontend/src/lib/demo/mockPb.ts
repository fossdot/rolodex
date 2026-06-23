// In-memory stand-in for the PocketBase JS SDK, used only in the static demo
// build (VITE_DEMO=1). It implements the exact subset of the SDK the app uses —
// collection CRUD, a filter-string evaluator, sort/expand/pagination, and a fake
// auth store — over the seed data in ./data. No network, no backend.

import { freshDb, DEMO_AUTH_USER, type Rec } from './data';

type Db = Record<string, Rec[]>;

// Which relation fields point at which collection (for `expand` and `a.b` paths).
const REL_TARGET: Record<string, string> = {
  added_by: 'users',
  logged_by: 'users',
  deleted_by: 'users',
  editor: 'users',
  user: 'users',
  contact: 'contacts',
  activity: 'activities',
};

// ── Filter evaluator ─────────────────────────────────────────────────────────
type Tok = { t: 'op' | 'bool' | 'paren' | 'str' | 'ident'; v: string };

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ' || ch === '\t' || ch === '\n') { i++; continue; }
    if (ch === "'") {
      let v = '';
      i++;
      while (i < s.length) {
        if (s[i] === '\\') { v += s[i + 1] ?? ''; i += 2; continue; }
        if (s[i] === "'") { i++; break; }
        v += s[i++];
      }
      out.push({ t: 'str', v });
      continue;
    }
    if (ch === '(' || ch === ')') { out.push({ t: 'paren', v: ch }); i++; continue; }
    const two = s.slice(i, i + 2);
    if (two === '&&' || two === '||') { out.push({ t: 'bool', v: two }); i += 2; continue; }
    if (two === '?~' || two === '?=' || two === '!=' || two === '>=' || two === '<=') { out.push({ t: 'op', v: two }); i += 2; continue; }
    if (ch === '~' || ch === '=' || ch === '>' || ch === '<') { out.push({ t: 'op', v: ch }); i++; continue; }
    // identifier / field path / null / number
    let v = '';
    while (i < s.length && /[A-Za-z0-9_.@:-]/.test(s[i])) v += s[i++];
    if (v) { out.push({ t: 'ident', v }); continue; }
    i++; // skip anything unexpected
  }
  return out;
}

// Resolve a field path against a record, following relations / back-relations.
// Returns { values: unknown[] } — always a list so "any-match" operators work.
function resolvePath(rec: Rec, path: string, db: Db): unknown[] {
  const segs = path.split('.');

  // back-relation: activities_via_contact.<field> on a contact
  if (segs[0] === 'activities_via_contact') {
    const related = (db.activities || []).filter((act) => act.contact === rec.id);
    const rest = segs.slice(1);
    if (!rest.length) return related;
    return related.map((act) => resolveOne(act, rest, db));
  }
  return [resolveOne(rec, segs, db)];
}

function resolveOne(rec: Rec | undefined, segs: string[], db: Db): unknown {
  let cur: unknown = rec;
  for (let k = 0; k < segs.length; k++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    const seg = segs[k];
    const val = (cur as Rec)[seg];
    // follow a relation id to the target record for the remaining segments
    if (k < segs.length - 1 && REL_TARGET[seg] && typeof val === 'string') {
      cur = (db[REL_TARGET[seg]] || []).find((r) => r.id === val);
    } else {
      cur = val;
    }
  }
  return cur;
}

const isEmpty = (v: unknown) => v == null || v === '';
const lc = (v: unknown) => String(v ?? '').toLowerCase();

function compare(op: string, left: unknown[], right: string | null): boolean {
  // flatten arrays (e.g. fu_roles is itself an array; back-relation gave a list)
  const vals: unknown[] = [];
  for (const v of left) Array.isArray(v) ? vals.push(...v) : vals.push(v);

  switch (op) {
    case '=':
      if (right === null) return vals.length === 0 || vals.every(isEmpty);
      return vals.some((v) => String(v) === right);
    case '!=':
      if (right === null) return vals.some((v) => !isEmpty(v));
      return vals.every((v) => String(v) !== right);
    case '~':
    case '?~':
      return vals.some((v) => !isEmpty(v) && lc(v).includes(lc(right)));
    case '?=':
      return vals.some((v) => String(v) === right);
    case '>=': return vals.some((v) => String(v) >= String(right));
    case '<=': return vals.some((v) => String(v) <= String(right));
    case '>': return vals.some((v) => String(v) > String(right));
    case '<': return vals.some((v) => String(v) < String(right));
    default: return false;
  }
}

// recursive-descent: orExpr := andExpr (|| andExpr)* ; andExpr := primary (&& primary)*
function makeEvaluator(tokens: Tok[]): (rec: Rec, db: Db) => boolean {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseOr(): (rec: Rec, db: Db) => boolean {
    let left = parseAnd();
    while (peek() && peek().t === 'bool' && peek().v === '||') {
      next();
      const right = parseAnd();
      const l = left;
      left = (rec, db) => l(rec, db) || right(rec, db);
    }
    return left;
  }
  function parseAnd(): (rec: Rec, db: Db) => boolean {
    let left = parsePrimary();
    while (peek() && peek().t === 'bool' && peek().v === '&&') {
      next();
      const right = parsePrimary();
      const l = left;
      left = (rec, db) => l(rec, db) && right(rec, db);
    }
    return left;
  }
  function parsePrimary(): (rec: Rec, db: Db) => boolean {
    const tk = peek();
    if (tk && tk.t === 'paren' && tk.v === '(') {
      next();
      const inner = parseOr();
      if (peek() && peek().v === ')') next();
      return inner;
    }
    // comparison: ident OP (str | ident:null)
    const field = next(); // ident (field path)
    const opTok = next(); // op
    const rhs = next(); // str or ident(null)
    if (!field || !opTok || !rhs) return () => true;
    const path = field.v;
    const op = opTok.v;
    const right = rhs.t === 'str' ? rhs.v : rhs.v === 'null' ? null : rhs.v;
    return (rec, db) => compare(op, resolvePath(rec, path, db), right);
  }

  const fn = parseOr();
  return (rec, db) => {
    pos = 0; // evaluator captures fresh each call via closures already built
    return fn(rec, db);
  };
}

function buildFilter(filter?: string): (rec: Rec, db: Db) => boolean {
  if (!filter || !filter.trim()) return () => true;
  try {
    const ev = makeEvaluator(tokenize(filter));
    return ev;
  } catch {
    return () => true; // never let a parse hiccup blank the demo
  }
}

// ── sort / expand / shape ────────────────────────────────────────────────────
function applySort(items: Rec[], sort?: string): Rec[] {
  if (!sort) return items;
  const keys = sort.split(',').map((s) => s.trim()).filter(Boolean);
  return [...items].sort((a, b) => {
    for (const k of keys) {
      const desc = k.startsWith('-');
      const field = desc ? k.slice(1) : k;
      const av = String(a[field] ?? '');
      const bv = String(b[field] ?? '');
      if (av < bv) return desc ? 1 : -1;
      if (av > bv) return desc ? -1 : 1;
    }
    return 0;
  });
}

function withExpand(rec: Rec, expand: string | undefined, db: Db): Rec {
  if (!expand) return { ...rec };
  const out: Rec = { ...rec };
  const exp: Record<string, unknown> = {};
  for (const field of expand.split(',').map((s) => s.trim()).filter(Boolean)) {
    const target = REL_TARGET[field];
    if (!target) continue;
    const id = rec[field];
    if (typeof id === 'string' && id) {
      const found = (db[target] || []).find((r) => r.id === id);
      if (found) exp[field] = { ...found };
    }
  }
  out.expand = exp;
  return out;
}

let idCounter = 1000;
function genId(): string {
  return `demo_${(idCounter++).toString(36)}_${Math.floor(performance.now()).toString(36)}`;
}

function formToObject(data: unknown): Rec {
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const obj: Record<string, unknown> = {};
    for (const key of new Set(data.keys())) {
      const all = data.getAll(key);
      // multi-value fields (fu_roles, topics) come back as arrays; files dropped
      const vals = all.filter((v) => typeof v === 'string');
      obj[key] = (key === 'fu_roles' || key === 'topics') ? vals : (vals[vals.length - 1] ?? '');
    }
    return obj as Rec;
  }
  return { ...(data as Rec) };
}

// ── The mock client ──────────────────────────────────────────────────────────
class Collection {
  constructor(private name: string, private db: Db, private auth: AuthStore) {}

  private all() { return this.db[this.name] || (this.db[this.name] = []); }

  private query(opts: { filter?: string; sort?: string; expand?: string } = {}) {
    const pred = buildFilter(opts.filter);
    let items = this.all().filter((r) => pred(r, this.db));
    items = applySort(items, opts.sort);
    return items.map((r) => withExpand(r, opts.expand, this.db));
  }

  async getFullList<T = Rec>(opts: any = {}): Promise<T[]> {
    return this.query(opts) as unknown as T[];
  }

  async getList<T = Rec>(page = 1, perPage = 30, opts: any = {}): Promise<any> {
    const items = this.query(opts);
    const totalItems = items.length;
    const start = (page - 1) * perPage;
    return {
      page, perPage, totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / perPage)),
      items: items.slice(start, start + perPage) as unknown as T[],
    };
  }

  async getOne<T = Rec>(id: string, opts: any = {}): Promise<T> {
    const found = this.all().find((r) => r.id === id);
    if (!found) throw { status: 404, message: 'Not found', response: { message: 'Not found' } };
    return withExpand(found, opts?.expand, this.db) as unknown as T;
  }

  async create<T = Rec>(data: unknown): Promise<T> {
    const obj = formToObject(data);
    const now = new Date().toISOString();
    const rec: Rec = { ...obj, id: genId(), created: now, updated: now };
    // mirror the server hooks: stamp the acting user on the attribution field
    const uid = this.auth.record?.id ?? '';
    if (this.name === 'contacts') rec.added_by = uid;
    if (this.name === 'activities') rec.logged_by = uid;
    if (this.name === 'contact_logs') rec.editor = uid;
    if (this.name === 'reactions') {
      rec.user = uid;
      // re-reacting replaces the previous reaction on that activity
      const existing = this.all().findIndex((r) => r.user === uid && r.activity === rec.activity);
      if (existing >= 0) this.all().splice(existing, 1);
    }
    if (this.name === 'contacts') { rec.deleted_at = rec.deleted_at || ''; rec.deleted_by = rec.deleted_by || ''; }
    this.all().push(rec);
    return { ...rec } as unknown as T;
  }

  async update<T = Rec>(id: string, data: unknown): Promise<T> {
    const rec = this.all().find((r) => r.id === id);
    if (!rec) throw { status: 404, message: 'Not found', response: { message: 'Not found' } };
    Object.assign(rec, formToObject(data), { updated: new Date().toISOString() });
    return { ...rec } as unknown as T;
  }

  async delete(id: string): Promise<boolean> {
    const arr = this.all();
    const i = arr.findIndex((r) => r.id === id);
    if (i >= 0) arr.splice(i, 1);
    return true;
  }

  // ── auth methods (only meaningful on the 'users' collection) ──
  async authWithPassword(identity: string): Promise<any> {
    const user = (this.db.users || []).find((u) => u.email === identity) || DEMO_AUTH_USER;
    this.auth._login(user);
    return { token: this.auth.token, record: user };
  }
  async authWithOAuth2(): Promise<any> {
    this.auth._login(DEMO_AUTH_USER);
    return { token: this.auth.token, record: DEMO_AUTH_USER };
  }
  async requestOTP(): Promise<any> { return { otpId: 'demo-otp' }; }
  async authWithOTP(): Promise<any> {
    this.auth._login(DEMO_AUTH_USER);
    return { token: this.auth.token, record: DEMO_AUTH_USER };
  }
  async requestPasswordReset(): Promise<boolean> { return true; }
  async confirmPasswordReset(): Promise<boolean> { return true; }
  async authRefresh(): Promise<any> { return { token: this.auth.token, record: this.auth.record }; }
}

class AuthStore {
  record: Rec | null = null;
  private listeners: (() => void)[] = [];
  constructor(initial: Rec | null) { this.record = initial; }
  get isValid() { return !!this.record; }
  get token() { return this.record ? 'demo-token' : ''; }
  get model() { return this.record; } // older SDK alias
  onChange(cb: () => void) { this.listeners.push(cb); return () => {}; }
  clear() { this.record = null; this.emit(); }
  _login(u: Rec) { this.record = u; this.emit(); }
  private emit() { this.listeners.forEach((cb) => cb()); }
}

export function createDemoPb() {
  const db = freshDb();
  // Auto-sign-in as the demo admin so viewers land straight in the app.
  const authStore = new AuthStore(DEMO_AUTH_USER);
  return {
    authStore,
    autoCancellation(_v?: boolean) {},
    files: { getURL() { return ''; } }, // demo contacts have no photos → Avatar shows initials
    collection(name: string) { return new Collection(name, db, authStore); },
    filter(raw: string) { return raw; },
  };
}
