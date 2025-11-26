export interface NodeSpec {
  description: string;
  maxIn: number;
  maxOut: number;
  allowedOutgoing: string[];
  allowedIncoming: string[];
}

export const FlowNodeRegistry: Record<
  string,
  {
    description: string;
    maxIn: number;
    maxOut: number;
    allowedOutgoing: string[];
    allowedIncoming: string[];
  }
> = {
  Build: {
    description: "  Build structures",
    maxIn: 0,
    maxOut: 1,
    allowedOutgoing: ["Compute"],
    allowedIncoming: [],
  },
  Compute: {
    description: "  Run calculation/simulation)",
    maxIn: 1,
    maxOut: 1,
    allowedOutgoing: ["Validate"],
    allowedIncoming: ["Build"],
  },
  Validate: {
    description: "  Analyze and verify data",
    maxIn: 1,
    maxOut: 0,
    allowedOutgoing: [],
    allowedIncoming: ["Compute"],
  },
};
