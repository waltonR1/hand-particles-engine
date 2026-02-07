import type { GesturePlugin, GestureContext, PluginPhase } from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";

// noinspection JSUnusedGlobalSymbols
/**
 * ======================================================
 * GestureShapePlugin
 * ======================================================
 *
 * 基于手势状态的“形状选择”插件
 *
 * 语义定位（IMPORTANT）：
 * - 不识别新的手势
 * - 只根据已有的手势“连续状态”（pinch）
 *   → 推导出“当前更适合的形状语义”
 *
 * 本插件的本质是：
 * 👉 Gesture → Symbolic Mapping（象征映射）
 *
 * 它并不产生新的交互维度，
 * 而是把已有维度（pinch）解释为“形状偏好”
 * ======================================================
 */
export default class GestureShapePlugin implements GesturePlugin {

    /**
     * 插件名称
     */
    name = "ShapeByGesture";

    /**
     * 插件执行阶段
     *
     * after 阶段说明（IMPORTANT）：
     * - 该插件依赖：
     *   - 单手判断
     *   - pinch 的稳定计算
     *   - 其它插件可能已经产生的 MODE / SPREAD 等事件
     *
     * 因此它不应该抢在前面执行，
     * 而是作为“语义解释层”放在 after 阶段
     */
    phase: PluginPhase = "after";

    /**
     * 插件优先级
     *
     * 说明：
     * - 在 after 阶段内排序
     * - 10 属于中等优先级
     * - 允许未来在 after 阶段再插入：
     *   - 更高级的 shape 策略插件
     */
    priority = 10;

    /**
     * update：根据单手 pinch 程度选择目标形状
     *
     * @param frames 当前帧检测到的手
     * @param _ctx 时间上下文（本插件未使用）
     *
     * @returns InteractionEvent[]
     */
    update(frames: HandFrame[], _ctx: GestureContext): InteractionEvent[] {

        // ==========================
        // 前置条件：必须且仅有一只手
        // ==========================
        //
        // 设计说明：
        // - 双手交互通常已有明确语义（DualHandPlugin）
        // - 这里专注于单手的“情绪 / 意图映射”
        //
        if (frames.length !== 1) return [];

        /**
         * pinch 值回顾：
         * - 0 → 手指完全张开
         * - 1 → 手指完全捏紧
         */
        const p = frames[0].pinch;

        /**
         * 形状映射策略（IMPORTANT）：
         *
         * - pinch 很大（> 0.8）
         *   → 明确、强烈的动作
         *   → HEART（情绪化、符号化）
         *
         * - pinch 很小（< 0.2）
         *   → 完全张开
         *   → WAVE（开放、流动）
         *
         * - 中间状态
         *   → 默认、稳定形态
         *   → SPHERE
         *
         * 注意：
         * - 这是“离散映射”，不是连续插值
         * - 是否平滑切换由 ParticleSystem 决定
         */
        if (p > 0.8)
            return [{ type: "SHAPE", name: "HEART" }];

        if (p < 0.2)
            return [{ type: "SHAPE", name: "WAVE" }];

        // 中性状态：回到默认形状
        return [{ type: "SHAPE", name: "SPHERE" }];
    }
}
