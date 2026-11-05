/** Server-only settings. Values come from .env.local, which never enters git. */
function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env.local`);
  return v;
}

export const env = {
  hederaOperatorId: () => need("HEDERA_OPERATOR_ID"),
  hederaOperatorKey: () => need("HEDERA_OPERATOR_KEY"),
  arkivKey: () => need("ARKIV_PRIVATE_KEY") as `0x${string}`,
  arkivAccessKey: () => need("ARKIV_ACCESS_KEY"),
  zgKey: () => need("ZG_PRIVATE_KEY"),
  zgRpc: () => process.env.ZG_RPC ?? "https://evmrpc.0g.ai",
  zgProvider: () => process.env.ZG_VISION_PROVIDER ?? "0x1B3AAef3ae5050EEE04ea38cD4B087472BD85EB0",
  zgModel: () => process.env.ZG_VISION_MODEL ?? "qwen3.7-plus",
};
