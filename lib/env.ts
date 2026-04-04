export function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    console.error(`❌ Missing ENV: ${name}`);
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const getEnv = requireEnv;
