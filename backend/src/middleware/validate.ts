import type { Request, Response, NextFunction } from 'express';

export interface FieldRule {
  field: string;
  source?: 'body' | 'params' | 'query';
  required?: boolean;
  maxLength?: number;
  oneOf?: string[];
}

export interface ValidationContext {
  body: Record<string, unknown>;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
}

/**
 * Pure validation: returns an error message or null if all rules pass.
 * Used by the Express middleware and unit-tested without HTTP mocks.
 */
export function validateFields(rules: FieldRule[], ctx: ValidationContext): string | null {
  for (const rule of rules) {
    const source = rule.source || 'body';
    const obj = source === 'body' ? ctx.body : source === 'params' ? ctx.params : ctx.query;
    const value = obj?.[rule.field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      return `${rule.field} is required`;
    }

    if (value === undefined || value === null) continue;

    if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
      return `${rule.field} must be at most ${rule.maxLength} characters`;
    }

    if (rule.oneOf && !rule.oneOf.includes(value as string)) {
      return `${rule.field} must be one of: ${rule.oneOf.join(', ')}`;
    }
  }
  return null;
}

export function validate(rules: FieldRule[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ctx: ValidationContext = {
      body: req.body as Record<string, unknown>,
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
    };
    const error = validateFields(rules, ctx);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    next();
  };
}
