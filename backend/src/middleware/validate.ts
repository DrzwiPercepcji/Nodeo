import type { Request, Response, NextFunction } from 'express';

interface FieldRule {
  field: string;
  source?: 'body' | 'params' | 'query';
  required?: boolean;
  maxLength?: number;
  oneOf?: string[];
}

export function validate(rules: FieldRule[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    for (const rule of rules) {
      const source = rule.source || 'body';
      const obj = source === 'body' ? req.body : source === 'params' ? req.params : req.query;
      const value = obj?.[rule.field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        res.status(400).json({ error: `${rule.field} is required` });
        return;
      }

      if (value === undefined || value === null) continue;

      if (rule.maxLength && typeof value === 'string' && value.length > rule.maxLength) {
        res.status(400).json({ error: `${rule.field} must be at most ${rule.maxLength} characters` });
        return;
      }

      if (rule.oneOf && !rule.oneOf.includes(value as string)) {
        res.status(400).json({ error: `${rule.field} must be one of: ${rule.oneOf.join(', ')}` });
        return;
      }
    }
    next();
  };
}
