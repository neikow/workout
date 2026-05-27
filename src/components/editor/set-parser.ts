// Parser for working-set / warmup-set lines such as:
//   66kg x 8
//   66kg x 8 x 3
//   -9kg x 10 x 3                (assisted)
//   0kg x (8 + 10 + 12)          (per-set rep list)
//   52kg x (10 x 2 + 9 x 1)      (mixed)
//   14kg x ((8 x 2) + (4 x 2))   (nested)
//   73kg x 1 + 66kg x 5          (multiple weights / drop sets)
//   100kg x 20 x 3 (fin de séance)   (trailing note)
//   30kg x 10 ???                (flagged)
//
// The grammar produces, per line, a list of "movements" (weight + the set of
// reps performed at that weight). Reps are expanded to one number per set so
// totals are trivial to derive.

const UNITS = ["kg", "lbs", "lb", "g"] as const;
export type WeightUnit = (typeof UNITS)[number];

export interface ParsedWeight {
  value: number;
  unit: WeightUnit | null;
  assisted: boolean;
}

export interface ParsedMovement {
  weight: ParsedWeight | null;
  reps: number[];
}

export interface ParsedSetLine {
  raw: string;
  movements: ParsedMovement[];
  note: string | null;
  flagged: boolean;
  totalReps: number;
  totalSets: number;
  volume: number;
  ok: boolean;
  error?: string;
}

type Token =
  | { t: "num"; value: number; unit: WeightUnit | null }
  | { t: "x" }
  | { t: "plus" }
  | { t: "lp" }
  | { t: "rp" };

const TOKEN_RE = new RegExp(
  String.raw`\s+|(-?\d+(?:\.\d+)?)(${UNITS.join("|")})?|([xX])|(\+)|(\()|(\))`,
  "g",
);

class ParseError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  TOKEN_RE.lastIndex = 0;
  let cursor = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(input))) {
    if (m.index !== cursor) {
      throw new ParseError(`unexpected "${input.slice(cursor, m.index)}"`);
    }
    cursor = TOKEN_RE.lastIndex;
    const [whole, num, unit, x, plus, lp, rp] = m;
    if (num !== undefined) {
      tokens.push({
        t: "num",
        value: Number(num),
        unit: (unit as WeightUnit | undefined) ?? null,
      });
    } else if (x !== undefined) {
      tokens.push({ t: "x" });
    } else if (plus !== undefined) {
      tokens.push({ t: "plus" });
    } else if (lp !== undefined) {
      tokens.push({ t: "lp" });
    } else if (rp !== undefined) {
      tokens.push({ t: "rp" });
    } else if (!/^\s+$/.test(whole)) {
      throw new ParseError(`unexpected "${whole}"`);
    }
  }
  if (cursor !== input.length) {
    throw new ParseError(`unexpected "${input.slice(cursor)}"`);
  }
  return tokens;
}

class Parser {
  private i = 0;
  constructor(private readonly toks: Token[]) {}

  private peek(): Token | undefined {
    return this.toks[this.i];
  }
  private next(): Token {
    const t = this.toks[this.i++];
    if (!t) throw new ParseError("unexpected end of input");
    return t;
  }
  private expect(t: Token["t"]): void {
    if (this.peek()?.t !== t) throw new ParseError(`expected ${t}`);
    this.i++;
  }
  atEnd(): boolean {
    return this.i >= this.toks.length;
  }

  // A bare number yields a scalar (usable as a multiplier); a parenthesized
  // group yields only its expanded set list.
  private factor(): { sets: number[]; scalar: number | null } {
    const tok = this.peek();
    if (tok?.t === "num") {
      this.next();
      return { sets: [tok.value], scalar: tok.value };
    }
    if (tok?.t === "lp") {
      this.next();
      const sets = this.sum();
      this.expect("rp");
      return { sets, scalar: null };
    }
    throw new ParseError("expected number or (");
  }

  // product := factor ('x' factor)*  — left factor is reps, the rest repeat it.
  private product(): number[] {
    let acc = this.factor().sets;
    while (this.peek()?.t === "x") {
      this.next();
      const f = this.factor();
      const times = f.scalar ?? f.sets.length;
      const repeated: number[] = [];
      for (let n = 0; n < times; n++) repeated.push(...acc);
      acc = repeated;
    }
    return acc;
  }

  // sum := product ('+' product)*  — only valid inside parentheses, where '+'
  // joins differing sets. At the top level '+' separates movements instead.
  private sum(): number[] {
    let acc = this.product();
    while (this.peek()?.t === "plus") {
      this.next();
      acc = acc.concat(this.product());
    }
    return acc;
  }

  private movement(): ParsedMovement {
    const head = this.peek();
    if (head?.t !== "num") throw new ParseError("expected weight");
    this.next();
    const weight: ParsedWeight = {
      value: head.value,
      unit: head.unit,
      assisted: head.value < 0,
    };
    let reps: number[] = [];
    if (this.peek()?.t === "x") {
      this.next();
      reps = this.product();
    }
    return { weight, reps };
  }

  parseLine(): ParsedMovement[] {
    const movements = [this.movement()];
    while (this.peek()?.t === "plus") {
      this.next();
      movements.push(this.movement());
    }
    if (!this.atEnd()) throw new ParseError("trailing tokens");
    return movements;
  }
}

function tokenizes(input: string): boolean {
  if (!input.trim()) return false;
  try {
    tokenize(input);
    return true;
  } catch {
    return false;
  }
}

function extractTrailing(input: string): {
  body: string;
  note: string | null;
  flagged: boolean;
} {
  let body = input.trim();
  let flagged = false;
  if (body.includes("?")) {
    flagged = /\?/.test(body);
    body = body.replace(/\?+/g, " ").trim();
  }
  let note: string | null = null;
  // A trailing parenthetical is a human note only if its contents are not a
  // valid rep expression — otherwise it's a per-set list like (8 + 10 + 12).
  const noteMatch = body.match(/\(([^()]*)\)\s*$/);
  if (noteMatch && !tokenizes(noteMatch[1])) {
    note = noteMatch[1].trim();
    body = body.slice(0, noteMatch.index).trim();
  }
  return { body, note, flagged };
}

export function parseSetLine(input: string): ParsedSetLine {
  const { body, note, flagged } = extractTrailing(input);

  const base: ParsedSetLine = {
    raw: input,
    movements: [],
    note,
    flagged,
    totalReps: 0,
    totalSets: 0,
    volume: 0,
    ok: false,
  };

  if (!body) {
    return { ...base, error: "no set expression" };
  }

  try {
    const movements = new Parser(tokenize(body)).parseLine();
    let totalReps = 0;
    let totalSets = 0;
    let volume = 0;
    for (const mv of movements) {
      totalReps += mv.reps.reduce((s, r) => s + r, 0);
      totalSets += mv.reps.length;
      if (mv.weight) {
        volume += mv.weight.value * mv.reps.reduce((s, r) => s + r, 0);
      }
    }
    return {
      ...base,
      movements,
      totalReps,
      totalSets,
      volume,
      ok: true,
    };
  } catch (e) {
    return {
      ...base,
      error: e instanceof ParseError ? e.message : String(e),
    };
  }
}
