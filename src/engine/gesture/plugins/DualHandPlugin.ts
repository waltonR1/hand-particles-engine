import type {GesturePlugin, GestureContext, PluginPhase} from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";

// noinspection JSUnusedGlobalSymbols
export default class DualHandPlugin implements GesturePlugin {
    name = "DualHand";
    phase:PluginPhase = "main";
    priority = 5;


    update(frames: HandFrame[], _ctx: GestureContext): InteractionEvent[] {
        if (frames.length < 2) return [];

        const [a, b] = frames;
        const dx = a.center.x - b.center.x;
        const dy = a.center.y - b.center.y;
        const dist = Math.hypot(dx, dy);

        return [
            { type: "MODE", mode: "DUAL" },
            { type: "ZOOM", value: 0.6 + dist * 3 },
            { type: "ROTATE", angle: Math.atan2(dy, dx) },
            ...(dist < 0.12 ? [{ type: "CONVERGE" as const }] : []),
            ...(dist > 0.6 ? [{ type: "SCATTER" as const }] : []),
        ];
    }
}
