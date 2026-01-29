import type {GesturePlugin, GestureContext, PluginPhase} from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";
import { clamp01 } from "../../../utils/math";

// noinspection JSUnusedGlobalSymbols
export default class PinchSpreadPlugin implements GesturePlugin {
    name = "PinchSpread";
    phase:PluginPhase = "main";
    priority = 20;


    update(frames: HandFrame[], _ctx: GestureContext): InteractionEvent[] {
        if (frames.length !== 1) return [];
        return [{ type: "SPREAD", value: clamp01(1 - frames[0].pinch) }];
    }
}
