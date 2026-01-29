import type {GesturePlugin, GestureContext, PluginPhase} from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";

// noinspection JSUnusedGlobalSymbols
export default class SingleHandMovePlugin implements GesturePlugin {
    name = "SingleHandMove";
    phase:PluginPhase = "main";
    priority = 10;


    update(frames: HandFrame[], _ctx: GestureContext): InteractionEvent[] {
        if (frames.length !== 1) return [];
        const h = frames[0];

        return [
            { type: "MODE", mode: "SINGLE" },
            { type: "MOVE", nx: h.center.x, ny: h.center.y },
            { type: "ZOOM", value: 0.8 + h.size },
        ];
    }
}
