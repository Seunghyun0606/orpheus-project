import { z } from 'zod';
import { canonicalJson } from './canonical.ts';

export type Condition =
  | { type: 'all'; children: Condition[] }
  | { type: 'any'; children: Condition[] }
  | { type: 'not'; child: Condition }
  | {
      type: 'compare';
      reference: string;
      operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
      expected: number | boolean | string;
    };

const scalar = z.union([z.number().finite(), z.boolean(), z.string()]);
export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('all'), children: z.array(conditionSchema).min(1) }).strict(),
    z.object({ type: z.literal('any'), children: z.array(conditionSchema).min(1) }).strict(),
    z.object({ type: z.literal('not'), child: conditionSchema }).strict(),
    z
      .object({
        type: z.literal('compare'),
        reference: z.string().min(1),
        operator: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte']),
        expected: scalar,
      })
      .strict(),
  ]),
);

export const referenceSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    valueType: z.enum(['number', 'boolean', 'string']),
    // Consumers bind declared sources; never arbitrary object paths or callbacks.
    source: z.enum([
      'act',
      'alignment',
      'value',
      'evidence',
      'completed',
      'narrative_flag',
      'ending_flag',
      'metric',
    ]),
    key: z.string().min(1),
    contexts: z.array(z.enum(['progression', 'effect', 'branch', 'ending', 'action'])).min(1),
  })
  .strict();
export type Reference = z.infer<typeof referenceSchema>;
export type Observation =
  | { status: 'available'; value: number | boolean | string }
  | { status: 'unavailable'; reason: string };
const observationSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('available'), value: scalar }).strict(),
  z.object({ status: z.literal('unavailable'), reason: z.string().min(1) }).strict(),
]);
const contextSchema = z
  .object({
    definitionVersion: z.string().min(1),
    kind: z.enum(['progression', 'effect', 'branch', 'ending', 'action']),
    runId: z.string().min(1),
    boundary: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    observations: z.record(z.string(), observationSchema),
  })
  .strict();
export interface ConditionContext {
  definitionVersion: string;
  kind: Reference['contexts'][number];
  runId: string;
  boundary: number;
  observations: Readonly<Record<string, Observation>>;
}
export interface CampaignDiagnostic {
  code: string;
  path: string;
}
export type ConditionResult =
  { ok: true; value: boolean } | { ok: false; diagnostics: CampaignDiagnostic[] };

export function orderedDiagnostics(items: CampaignDiagnostic[]): CampaignDiagnostic[] {
  const unique = new Map(items.map((item) => [JSON.stringify([item.code, item.path]), item]));
  return [...unique.values()].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : a.code < b.code ? -1 : a.code > b.code ? 1 : 0,
  );
}

export function validateConditionReferences(
  condition: Condition,
  references: readonly Reference[],
  version: string,
  kind: ConditionContext['kind'],
): CampaignDiagnostic[] {
  const diagnostics: CampaignDiagnostic[] = [];
  const visit = (node: Condition, path: string): void => {
    if (node.type === 'compare') {
      const matches = references.filter((ref) => ref.id === node.reference);
      const ref = matches[0];
      if (matches.length !== 1 || !ref || ref.version !== version || !ref.contexts.includes(kind))
        diagnostics.push({ code: 'INVALID_REFERENCE', path: node.reference });
      else if (
        typeof node.expected !== ref.valueType ||
        (ref.valueType !== 'number' && node.operator !== 'eq' && node.operator !== 'ne')
      )
        diagnostics.push({ code: 'INVALID_COMPARISON', path });
    } else if (node.type === 'not') visit(node.child, path + '.child');
    else node.children.forEach((child, i) => visit(child, path + '.children.' + i));
  };
  visit(condition, '$');
  return orderedDiagnostics(diagnostics);
}

export function evaluateCampaignCondition(
  input: unknown,
  references: readonly Reference[],
  context: ConditionContext,
): ConditionResult {
  try {
    canonicalJson(input);
    canonicalJson(references);
    canonicalJson(context);
  } catch {
    return { ok: false, diagnostics: [{ code: 'INVALID_DEFINITION_OR_CONTEXT', path: '$' }] };
  }
  const checkedContext = contextSchema.safeParse(context);
  if (!checkedContext.success)
    return { ok: false, diagnostics: [{ code: 'INVALID_CONTEXT', path: '$' }] };
  context = checkedContext.data;
  const parsed = conditionSchema.safeParse(input);
  const registry = z.array(referenceSchema).safeParse(references);
  if (!parsed.success || !registry.success)
    return { ok: false, diagnostics: [{ code: 'INVALID_DEFINITION', path: '$' }] };
  const condition = parsed.data;
  const diagnostics = validateConditionReferences(
    condition,
    registry.data,
    context.definitionVersion,
    context.kind,
  );
  if (
    !context.runId ||
    !Number.isSafeInteger(context.boundary) ||
    context.boundary < 0 ||
    !context.observations ||
    !context.definitionVersion
  )
    diagnostics.push({ code: 'INVALID_CONTEXT', path: '$' });
  if (diagnostics.length) return { ok: false, diagnostics: orderedDiagnostics(diagnostics) };
  const required = new Set<string>();
  const collect = (node: Condition): void => {
    if (node.type === 'compare') required.add(node.reference);
    else if (node.type === 'not') collect(node.child);
    else node.children.forEach(collect);
  };
  collect(condition);
  for (const id of [...required].sort()) {
    const ref = registry.data.find((candidate) => candidate.id === id)!;
    const observation = Object.hasOwn(context.observations, id)
      ? context.observations[id]
      : undefined;
    if (!observation) diagnostics.push({ code: 'MISSING_CONTEXT', path: id });
    else if (
      observation.status === 'unavailable' &&
      typeof observation.reason === 'string' &&
      observation.reason.length
    )
      diagnostics.push({ code: 'UNAVAILABLE_OBSERVATION', path: id });
    else if (
      observation.status !== 'available' ||
      typeof observation.value !== ref.valueType ||
      (typeof observation.value === 'number' && !Number.isFinite(observation.value))
    )
      diagnostics.push({ code: 'INVALID_CONTEXT', path: id });
  }
  if (diagnostics.length) return { ok: false, diagnostics: orderedDiagnostics(diagnostics) };
  const evaluate = (node: Condition): boolean => {
    if (node.type === 'all') return node.children.every(evaluate);
    if (node.type === 'any') return node.children.some(evaluate);
    if (node.type === 'not') return !evaluate(node.child);
    const observation = context.observations[node.reference]!;
    if (observation.status !== 'available') throw new Error('Availability invariant');
    const left = observation.value;
    const right = node.expected;
    switch (node.operator) {
      case 'eq':
        return left === right;
      case 'ne':
        return left !== right;
      case 'gt':
        return (left as number) > (right as number);
      case 'gte':
        return (left as number) >= (right as number);
      case 'lt':
        return (left as number) < (right as number);
      case 'lte':
        return (left as number) <= (right as number);
    }
  };
  return { ok: true, value: evaluate(condition) };
}
