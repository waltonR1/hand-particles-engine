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

// noinspection JSUnusedGlobalSymbols
export default class GestureLabelPlugin implements GesturePlugin {
    name = "GestureLabel";
    phase: PluginPhase = "before";
    priority = 0;

    // ===== 手势稳定机制 =====
    private lastGesture: GestureName = "NONE";
    private candidate: GestureName = "NONE";
    private holdFrames = 0;
    private readonly HOLD_THRESHOLD = 4;

    // PINCH 滞回
    private pinchActive = false;

    update(frames: HandFrame[]): InteractionEvent[] {
        // 无手
        if (frames.length === 0) {
            this.lastGesture = "NONE";
            return [{ type: "GESTURE_LABEL", label: "NONE" }];
        }

        // 双手强制优先
        if (frames.length >= 2) {
            this.lastGesture = "DUAL_HANDS";
            return [{ type: "GESTURE_LABEL", label: "DUAL_HANDS" }];
        }

        const raw = this.classify(frames[0]);

        // ===== 手势锁定缓冲（抗抖动）=====
        if (raw === this.lastGesture) {
            this.candidate = raw;
            this.holdFrames = 0;
        } else {
            if (raw === this.candidate) {
                this.holdFrames++;
                if (this.holdFrames >= this.HOLD_THRESHOLD) {
                    this.lastGesture = raw;
                    this.holdFrames = 0;
                }
            } else {
                this.candidate = raw;
                this.holdFrames = 1;
            }
        }

        return [{ type: "GESTURE_LABEL", label: this.lastGesture }];
    }

    // ================= 分类逻辑 =================

    private classify(h: HandFrame): GestureName {
        const lm = h.landmarks as any[];
        const pinch = h.pinch;

        // PINCH 滞回
        if (this.checkPinch(pinch)) return "PINCH";

        const extended = {
            index: this.isFingerExtended(lm, 6, 7, 8),
            middle: this.isFingerExtended(lm, 10, 11, 12),
            ring: this.isFingerExtended(lm, 14, 15, 16),
            pinky: this.isFingerExtended(lm, 18, 19, 20),
            thumb: this.isThumbExtended(lm),
        };

        const extCount =
            (extended.index ? 1 : 0) +
            (extended.middle ? 1 : 0) +
            (extended.ring ? 1 : 0) +
            (extended.pinky ? 1 : 0);

        // OK 手势
        if (extended.index && pinch > 0.28 && extCount >= 3) return "OK_SIGN";

        // FIST
        if (extCount === 0 && !extended.thumb) return "FIST";

        // V_SIGN 容错版
        if (
            extended.index &&
            extended.middle &&
            !extended.ring &&
            (extended.pinky ? pinch < 0.2 : true)
        )
            return "V_SIGN";

        // OPEN_PALM
        if (extCount >= 3) return "OPEN_PALM";

        // 避免 NONE 抖动：保持旧手势
        return this.lastGesture;
    }

    private checkPinch(pinch: number) {
        if (this.pinchActive) {
            if (pinch < 0.65) this.pinchActive = false;
        } else {
            if (pinch > 0.82) this.pinchActive = true;
        }
        return this.pinchActive;
    }

    private isFingerExtended(lm: any[], pip: number, dip: number, tip: number) {
        return lm[tip].y < lm[pip].y && lm[dip].y < lm[pip].y;
    }

    private isThumbExtended(lm: any[]) {
        return Math.abs(lm[4].x - lm[2].x) > 0.06;
    }
}
