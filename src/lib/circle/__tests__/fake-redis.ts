/**
 * An in-memory stand-in for the handful of Redis commands the circle store uses - enough to run the
 * store's real code in a test, with expiry ignored (tests run inside one instant).
 */
import type { RedisCommand } from '../store';

export interface FakeRedis {
  redis: RedisCommand;
  strings: Map<string, string>;
  sets: Map<string, Set<string>>;
  lists: Map<string, string[]>;
  hashes: Map<string, Map<string, string>>;
  commands: Array<(string | number)[]>;
  /** Make the next command (or every command, with `always`) throw, as a dropped connection does. */
  failNext: (always?: boolean) => void;
  /** End a failure started with failNext(true). */
  heal: () => void;
}

export function fakeRedis(): FakeRedis {
  const strings = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const lists = new Map<string, string[]>();
  const hashes = new Map<string, Map<string, string>>();
  const commands: Array<(string | number)[]> = [];
  let failing: 'no' | 'once' | 'always' = 'no';
  const hash = (key: string) => hashes.get(key) ?? hashes.set(key, new Map()).get(key)!;
  const set = (key: string) => sets.get(key) ?? sets.set(key, new Set()).get(key)!;
  const list = (key: string) => lists.get(key) ?? lists.set(key, []).get(key)!;

  const redis: RedisCommand = async (command) => {
    commands.push(command);
    if (failing !== 'no') {
      if (failing === 'once') failing = 'no';
      throw new Error('upstash 503');
    }
    const [name, ...args] = command.map(String);
    switch (name) {
      case 'GET':
        return strings.get(args[0]!) ?? null;
      case 'SET': {
        const [key, value, ...flags] = args;
        if (flags.includes('NX') && strings.has(key!)) return null;
        strings.set(key!, value!);
        return 'OK';
      }
      case 'DEL':
        for (const key of args) {
          strings.delete(key);
          lists.delete(key);
          sets.delete(key);
          hashes.delete(key);
        }
        return args.length;
      case 'INCR': {
        const next = (Number(strings.get(args[0]!) ?? 0) || 0) + 1;
        strings.set(args[0]!, String(next));
        return next;
      }
      case 'HSET':
        hash(args[0]!).set(args[1]!, args[2]!);
        return 1;
      case 'HDEL':
        return hash(args[0]!).delete(args[1]!) ? 1 : 0;
      case 'HGETALL':
        return [...hash(args[0]!).entries()].flat();
      case 'SADD':
        set(args[0]!).add(args[1]!);
        return 1;
      case 'SREM':
        set(args[0]!).delete(args[1]!);
        return 1;
      case 'SMEMBERS':
        return [...set(args[0]!)];
      case 'SCARD':
        return set(args[0]!).size;
      case 'LPUSH':
        list(args[0]!).unshift(args[1]!);
        return list(args[0]!).length;
      case 'LTRIM': {
        const items = list(args[0]!);
        lists.set(args[0]!, items.slice(Number(args[1]), Number(args[2]) + 1));
        return 'OK';
      }
      case 'LRANGE': {
        const items = list(args[0]!);
        return items.slice(Number(args[1]), Number(args[2]) + 1);
      }
      case 'EXPIRE':
        return 1;
      default:
        throw new Error(`fake redis: ${name} not implemented`);
    }
  };
  return {
    redis,
    strings,
    sets,
    lists,
    hashes,
    commands,
    failNext: (always = false) => {
      failing = always ? 'always' : 'once';
    },
    heal: () => {
      failing = 'no';
    },
  };
}
