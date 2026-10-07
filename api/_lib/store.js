// Data layer. Each collection is a Redis hash: field = document id, value = JSON document.
// `meta:v` is bumped on every write so clients can poll cheaply (one GET when nothing changed).
import crypto from 'node:crypto';
import { kv } from './kv.js';

export const COLLECTIONS = ['teams', 'matches', 'players', 'news'];
export const BOLGELER = ['Başkent', 'AYEDAŞ', 'Toroslar'];
const STATUSES = ['YAKINDA', 'CANLI', 'BİTTİ'];
const YAKA = ['Mavi Yaka', 'Beyaz Yaka'];

const str = (max) => (v) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const nstr = (max) => (v) => (v === null || v === '' ? null : typeof v === 'string' ? v.trim().slice(0, max) : undefined);
const bool = (v) => (typeof v === 'boolean' ? v : undefined);
const int = (min, max) => (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};
const nint = (min, max) => (v) => (v === null || v === '' ? null : int(min, max)(v));
const oneOf = (list) => (v) => (list.includes(v) ? v : undefined);
const photo = (v) => (v === '' || v === null ? '' : typeof v === 'string' && /^\/api\/img\?id=[a-z0-9]{10,40}$/.test(v) ? v : undefined);
const color = (v) => (v === '' || v === null ? '' : typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : undefined);

// field validators + the fields that must exist on creation
const SCHEMA = {
  teams: {
    fields: { name: str(80), tag: str(120), bolge: oneOf(BOLGELER), password: str(80), color, photoUrl: photo },
    required: ['name', 'bolge', 'password'],
  },
  matches: {
    fields: {
      bolge: oneOf(BOLGELER), home: str(80), away: str(80), homeScore: nint(0, 99), awayScore: nint(0, 99),
      status: oneOf(STATUSES), week: str(60), venue: str(120), info: nstr(80),
    },
    required: ['bolge', 'home', 'away', 'status', 'week'],
  },
  players: {
    fields: {
      name: str(80), team: str(80), position: str(60), departman: str(80), yaka: oneOf(YAKA),
      goals: int(0, 999), assists: int(0, 999), captain: bool, photoUrl: photo,
    },
    required: ['name', 'team'],
  },
  news: {
    fields: { title: str(160), body: str(6000), tag: str(40), featured: bool, createdAt: int(0, 9_999_999_999_999), photoUrl: photo },
    required: ['title', 'body'],
  },
};

export function sanitize(col, input, { partial }) {
  const schema = SCHEMA[col];
  if (!schema) throw new Error('Bilinmeyen koleksiyon.');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Geçersiz veri.');
  const out = {};
  for (const [key, check] of Object.entries(schema.fields)) {
    if (!(key in input)) continue;
    const v = check(input[key]);
    if (v === undefined) throw new Error(`Geçersiz alan: ${key}`);
    out[key] = v;
  }
  if (!partial) {
    for (const key of schema.required) {
      if (out[key] === undefined || out[key] === '') throw new Error(`Eksik alan: ${key}`);
    }
  }
  return out;
}

export function newId() {
  return crypto.randomBytes(6).toString('base64url').replace(/[^a-zA-Z0-9]/g, 'x').toLowerCase();
}

export async function version() {
  return Number((await kv().get('meta:v')) || 0);
}

export async function bump() {
  return kv().incr('meta:v');
}

export async function readCollection(col) {
  return (await kv().hgetall(`col:${col}`)) || {};
}

export async function readAll({ admin }) {
  const [v, ...cols] = await Promise.all([version(), ...COLLECTIONS.map(readCollection)]);
  const data = { v };
  COLLECTIONS.forEach((c, i) => { data[c] = cols[i]; });
  if (!admin) {
    for (const id of Object.keys(data.teams)) {
      const { password, ...rest } = data.teams[id];
      data.teams[id] = rest;
    }
  }
  return data;
}

export async function getDoc(col, id) {
  return kv().hget(`col:${col}`, id);
}

export async function putDoc(col, id, doc) {
  await kv().hset(`col:${col}`, { [id]: doc });
  return bump();
}

export async function removeDoc(col, id) {
  await kv().hdel(`col:${col}`, id);
  return bump();
}
