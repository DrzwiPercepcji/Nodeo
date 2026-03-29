import { describe, it, expect } from 'vitest';
import { validateFields, type FieldRule } from '../src/middleware/validate.js';

describe('validateFields', () => {
  const empty = { body: {}, params: {}, query: {} };

  it('passes when no rules', () => {
    expect(validateFields([], { body: {}, params: {}, query: {} })).toBeNull();
  });

  it('requires field when rule.required', () => {
    const rules: FieldRule[] = [{ field: 'name', required: true }];
    expect(validateFields(rules, empty)).toBe('name is required');
    expect(validateFields(rules, { body: { name: 'x' }, params: {}, query: {} })).toBeNull();
  });

  it('treats empty string as missing when required', () => {
    const rules: FieldRule[] = [{ field: 'name', required: true }];
    expect(validateFields(rules, { body: { name: '' }, params: {}, query: {} })).toBe('name is required');
  });

  it('enforces maxLength', () => {
    const rules: FieldRule[] = [{ field: 'title', maxLength: 3 }];
    expect(validateFields(rules, { body: { title: 'abcd' }, params: {}, query: {} })).toBe(
      'title must be at most 3 characters',
    );
    expect(validateFields(rules, { body: { title: 'ab' }, params: {}, query: {} })).toBeNull();
  });

  it('enforces oneOf', () => {
    const rules: FieldRule[] = [{ field: 'role', oneOf: ['a', 'b'] }];
    expect(validateFields(rules, { body: { role: 'c' }, params: {}, query: {} })).toContain('role must be one of');
    expect(validateFields(rules, { body: { role: 'a' }, params: {}, query: {} })).toBeNull();
  });

  it('reads from params and query', () => {
    expect(
      validateFields([{ field: 'id', source: 'params', required: true }], {
        body: {},
        params: {},
        query: {},
      }),
    ).toBe('id is required');
    expect(
      validateFields([{ field: 'id', source: 'params', required: true }], {
        body: {},
        params: { id: '1' },
        query: {},
      }),
    ).toBeNull();
    expect(
      validateFields([{ field: 'q', source: 'query', required: true }], {
        body: {},
        params: {},
        query: { q: 'search' },
      }),
    ).toBeNull();
  });
});
