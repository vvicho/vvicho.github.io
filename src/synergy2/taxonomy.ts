export type TagKind =
  // inbound
  | "NeedsDON" | "NeedsLeaderType" | "NeedsLifeTaken" | "NeedsLifeChange"
  | "NeedsTarget:HasCounter" | "WantsCurve"
  // outbound
  | "KO:Cost" | "KO:Power" | "CostMod" | "Bounce:Cost" | "BottomDeck:Cost"
  | "RestTarget:Cost" | "DON:AddActive" | "DON:AddRested" | "DON:AttachRested" | "DON:Consume"
  | "LifeFaceUp" | "LifeTaken" | "Curve";

export const TAG_KINDS: { kind: TagKind; label: string; template: string; help: string }[] = [
  { kind: "NeedsDON", label: "Needs DON", template: "NeedsDON:>=1", help: "DON requirement (>=N)" },
  { kind: "NeedsLeaderType", label: "Needs Leader Type", template: "NeedsLeaderType:{Navy}", help: "Leader has {Category}" },
  { kind: "NeedsLifeTaken", label: "Needs Life Taken", template: "NeedsLifeTaken", help: "Triggers when life is taken" },
  { kind: "NeedsLifeChange", label: "Needs Life Change", template: "NeedsLifeChange", help: "Any life change" },
  { kind: "NeedsTarget:HasCounter", label: "Needs Target Has Counter", template: "NeedsTarget:HasCounter:0", help: "Targets with specific Counter value" },
  { kind: "WantsCurve", label: "Wants Curve", template: "WantsCurve:{Category}:>=5", help: "Deckbuild desire: category at or above cost" },

  { kind: "KO:Cost", label: "KO by Cost", template: "KO:Cost<=5", help: "K.O. target by cost threshold" },
  { kind: "KO:Power", label: "KO by Power", template: "KO:Power<=5000", help: "K.O. target by power threshold" },
  { kind: "CostMod", label: "Cost Modifier", template: "CostMod:-1", help: "Reduce (negative) or increase (positive) cost" },
  { kind: "Bounce:Cost", label: "Bounce by Cost", template: "Bounce:Cost<=5", help: "Return to hand by cost" },
  { kind: "BottomDeck:Cost", label: "Bottom Deck by Cost", template: "BottomDeck:Cost<=5", help: "Send to bottom by cost" },
  { kind: "RestTarget:Cost", label: "Rest Target by Cost", template: "RestTarget:Cost<=4", help: "Rest target by cost" },

  { kind: "DON:AddActive", label: "DON Add Active", template: "DON:AddActive:+1", help: "Add DON and set active" },
  { kind: "DON:AddRested", label: "DON Add Rested", template: "DON:AddRested:+1", help: "Add DON rested" },
  { kind: "DON:AttachRested", label: "DON Attach Rested", template: "DON:AttachRested:+1", help: "Attach rested DON" },
  { kind: "DON:Consume", label: "DON Consume", template: "DON:Consume:1", help: "Consume DON" },

  { kind: "LifeFaceUp", label: "Life Face Up", template: "LifeFaceUp:+1", help: "Turn life card face up" },
  { kind: "LifeTaken", label: "Life Taken Producer", template: "LifeTaken:+1", help: "Cause life to be taken" },

  { kind: "Curve", label: "Curve Producer", template: "Curve:{Category}:>=5", help: "This card plays on curve for category" },
];

// Simple “navigation” aliases (UI, not tag content): switch section keys
export const NAV_KEYS = {
  nextSection: "Tab",     // inbound -> outbound -> keywords
  prevSection: "Shift+Tab"
};


