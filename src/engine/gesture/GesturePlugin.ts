import type { HandFrame } from "../input/types/GestureTypes";
import type { InteractionEvent } from "../interaction/InteractionTypes";

export type GestureContext = {
    dt: number;
    time: number;
};

export type PluginPhase = "before" | "main" | "after";

export interface GesturePlugin {
    name: string;
    priority?: number;
    enabled?: boolean;
    phase?: PluginPhase;

    update(
        frames: HandFrame[],
        ctx: GestureContext
    ): InteractionEvent[];
}


