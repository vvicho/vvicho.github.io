export type CardLite = { id: string; name: string };

export type InboundTag = string;   // normalized expression string
export type OutboundTag = string;  // normalized expression string

export type SynergyTagsV2 = {
  meta: { version: number; generatedAt: string };
  cards: Record<string, {
    manual?: { inbound?: InboundTag[]; outbound?: OutboundTag[]; keywords?: string[] };
    auto?: { inbound?: InboundTag[]; outbound?: OutboundTag[]; keywords?: string[] };
  }>;
};

export type EdgeV2 = { from: string; to: string; reason: string; score: number };
export type SynergyIndexV2 = {
  byInbound: Record<string, string[]>;
  byOutbound: Record<string, string[]>;
  meta: any;
};


