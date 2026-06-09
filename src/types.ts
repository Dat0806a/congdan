export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface VideoConfig {
  idleStart: number;
  idleEnd: number;
}
