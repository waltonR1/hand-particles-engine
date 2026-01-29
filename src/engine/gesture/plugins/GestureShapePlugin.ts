import type {GesturePlugin, GestureContext, PluginPhase} from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";

// noinspection JSUnusedGlobalSymbols
export default class GestureShapePlugin implements GesturePlugin {
    name = "ShapeByGesture";
    phase:PluginPhase = "after";
    priority = 10;


    update(frames: HandFrame[], _ctx: GestureContext): InteractionEvent[] {
        if (frames.length !== 1) return [];

        const p = frames[0].pinch;

        if (p > 0.8) return [{ type: "SHAPE", name: "HEART" }];
        if (p < 0.2) return [{ type: "SHAPE", name: "WAVE" }];

        return [{ type: "SHAPE", name: "SPHERE" }];
    }
}
