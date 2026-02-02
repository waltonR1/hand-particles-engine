import type { GesturePlugin, PluginPhase } from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";

type GestureName =
    | "NONE"
    | "OPEN_PALM"
    | "FIST"
    | "V_SIGN"
    | "OK_SIGN"
    | "PINCH"
    | "DUAL_HANDS";

export default class GestureLabelPlugin implements GesturePlugin {
    name = "GestureLabel";
    phase: PluginPhase = "before";   // 必须早于其他插件
    priority = 0;

    update(frames: HandFrame[]): InteractionEvent[] {
        // 没有手
        if (frames.length === 0) {
            return [{ type: "GESTURE_LABEL", label: "NONE" }];
        }

        // 双手
        if (frames.length >= 2) {
            return [{ type: "GESTURE_LABEL", label: "DUAL_HANDS" }];
        }

        // 单手
        const g = classifyGesture(frames[0]);
        return [{ type: "GESTURE_LABEL", label: g }];
    }
}

/* ==== 下面是你原本 GestureEngine 里的分类逻辑（原封不动搬过来） ==== */

function classifyGesture(h: HandFrame): GestureName {
    const lm = h.landmarks as any[];
    const pinch = h.pinch;
    if (pinch > 0.78) return "PINCH";

    const extended = {
        index: isFingerExtended(lm, 6, 7, 8),
        middle: isFingerExtended(lm, 10, 11, 12),
        ring: isFingerExtended(lm, 14, 15, 16),
        pinky: isFingerExtended(lm, 18, 19, 20),
        thumb: isThumbExtended(lm),
    };

    const extCount =
        (extended.index ? 1 : 0) +
        (extended.middle ? 1 : 0) +
        (extended.ring ? 1 : 0) +
        (extended.pinky ? 1 : 0);

    if (extended.index && pinch > 0.28 && extCount >= 3) return "OK_SIGN";
    if (extCount === 0 && !extended.thumb) return "FIST";
    if (extended.index && extended.middle && !extended.ring && !extended.pinky) return "V_SIGN";
    if (extCount >= 3) return "OPEN_PALM";

    return "NONE";
}

function isFingerExtended(lm: any[], pip: number, dip: number, tip: number) {
    return lm[tip].y < lm[pip].y && lm[dip].y < lm[pip].y;
}

function isThumbExtended(lm: any[]) {
    return Math.abs(lm[4].x - lm[2].x) > 0.06;
}
