import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

const config = {
  port: parseInt(process.env.BACKEND_PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: required('POSTGRES_HOST'),
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: required('POSTGRES_DB'),
    user: required('POSTGRES_USER'),
    password: required('POSTGRES_PASSWORD'),
  },

  auth: {
    username: required('AUTH_USERNAME'),
    passwordHash: required('AUTH_PASSWORD_HASH'),
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: '90d',
  },

  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || 'eu-central-1',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    endpoint: process.env.S3_ENDPOINT || undefined,
  },
} as const;

export default config;
