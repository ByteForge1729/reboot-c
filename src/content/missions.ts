import { z } from "zod";
import raw from "./missions.json";
import { MISSION_COUNT } from "../save/schema";

const MissionMetaSchema = z.object({
  id: z.number().int().min(0),
  slug: z.string().min(1),
  system: z.string().min(1),
  topic: z.string().min(1),
  briefing: z.string().max(1000),
});
export type MissionMeta = z.infer<typeof MissionMetaSchema>;

// Content is data (AGENTS.md rule 7): a malformed file fails loudly at startup.
export const MISSIONS: readonly MissionMeta[] = z.array(MissionMetaSchema).length(MISSION_COUNT).parse(raw);

export function missionById(id: number): MissionMeta | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function systemCode(id: number): string {
  return `SYS-${String(id).padStart(2, "0")}`;
}
