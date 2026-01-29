import type { InteractionEvent } from "./InteractionTypes";
import { clamp01, lerp } from "../../utils/math";
import type { ShapeName } from "../particles/ShapeTypes";

/**
 * InteractionCore：把事件聚合成“统一状态”
 * 视觉系统只看 state，不关心手势/输入源
 */
export type InteractionState = {
    mode: "NONE" | "SINGLE" | "DUAL";

    // 平移（世界坐标）
    panX: number;
    panY: number;

    // 缩放（世界 scale）
    zoom: number;

    // 旋转（仅双手用）
    rotation: number;

    // 聚散（0..1）
    spread: number;

    // 脉冲事件
    scatter: boolean;
    converge: boolean;

    // 静止程度，用于呼吸（0..1）
    stillness: number;

    // 目标形状
    shape: ShapeName;

    // UI 展示用
    gestureLabel: string;
    shakeEnergy: number;
};

export class InteractionCore {
    state: InteractionState = {
        mode: "NONE",
        panX: 0,
        panY: 0,
        zoom: 1,
        rotation: 0,
        spread: 0.25,
        scatter: false,
        converge: false,
        stillness: 1,
        shape: "SPHERE",
        gestureLabel: "NONE",
        shakeEnergy: 0,
    };

    /**
     * 更新状态：把一帧 events 汇总成 state
     * 注意：scatter / converge 是“脉冲”，每帧会重置
     */
    update(events: InteractionEvent[]) {
        // 脉冲先清零
        this.state.scatter = false;
        this.state.converge = false;

        for (const e of events) {
            switch (e.type) {
                case "MODE":
                    this.state.mode = e.mode;
                    break;

                case "MOVE": {
                    // MOVE 用归一化坐标映射到世界
                    this.state.panX = (e.nx - 0.5) * 3.0;
                    this.state.panY = -(e.ny - 0.5) * 1.9;
                    break;
                }

                case "ZOOM":
                    // 直接设目标缩放（平滑在粒子系统里做也行）
                    this.state.zoom = e.value;
                    break;

                case "ROTATE":
                    this.state.rotation = e.angle;
                    break;

                case "SPREAD":
                    this.state.spread = clamp01(e.value);
                    break;

                case "SHAPE":
                    this.state.shape = e.name;
                    break;

                case "SCATTER":
                    this.state.scatter = true;
                    break;

                case "CONVERGE":
                    this.state.converge = true;
                    break;

                case "IDLE":
                    this.state.stillness = clamp01(e.stillness);
                    break;

                case "GESTURE_LABEL":
                    this.state.gestureLabel = e.label;
                    break;

                case "SHAKE_ENERGY":
                    this.state.shakeEnergy = e.value;
                    break;
            }
        }
    }
}
