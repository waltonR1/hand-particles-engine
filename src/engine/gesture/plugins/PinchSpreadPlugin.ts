import type { GesturePlugin, GestureContext, PluginPhase } from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";
import { clamp01 } from "../../../utils/math";

// noinspection JSUnusedGlobalSymbols
/**
 * ======================================================
 * PinchSpreadPlugin
 * ======================================================
 *
 * 单手 Pinch → 聚散（SPREAD）控制插件
 *
 * 语义定位（IMPORTANT）：
 * - 仅在「单手交互」时生效
 * - 使用 pinch 强度，生成连续的 SPREAD 语义事件
 *
 * 核心思想：
 * - pinch 是一个非常自然的“连续模拟量”
 * - 非常适合映射为：
 *   - 粒子密度
 *   - 聚合 / 发散程度
 *
 * 与 DualHandPlugin 的关系：
 * - DualHandPlugin：双手 → ZOOM / ROTATE / 脉冲
 * - PinchSpreadPlugin：单手 → 连续 SPREAD
 *
 * 两者在语义上互补，而不是冲突
 * ======================================================
 */
export default class PinchSpreadPlugin implements GesturePlugin {

    /**
     * 插件名称
     */
    name = "PinchSpread";

    /**
     * 插件执行阶段
     *
     * 说明：
     * - 聚散控制属于核心交互语义
     * - 放在 main 阶段
     */
    phase: PluginPhase = "main";

    /**
     * 插件优先级
     *
     * 说明：
     * - 20 属于中等优先级
     * - 通常在 MODE / DUAL 等基础判断之后执行
     */
    priority = 20;

    /**
     * update：根据单手 pinch 强度生成 SPREAD 事件
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
        // - frames.length === 1 → 单手模式
        // - 双手时交由 DualHandPlugin 处理
        //
        if (frames.length !== 1) return [];

        /**
         * SPREAD 映射逻辑
         *
         * frames[0].pinch 的语义：
         * - 0 → 手指完全张开
         * - 1 → 手指完全捏紧
         *
         * 这里取：
         *   spread = 1 - pinch
         *
         * 直觉解释：
         * - 手越张开 → 粒子越分散
         * - 手越捏紧 → 粒子越集中
         *
         * clamp01 的作用：
         * - 防御性处理
         * - 保证 SPREAD ∈ [0, 1]
         */
        return [
            {
                type: "SPREAD",
                value: clamp01(1 - frames[0].pinch),
            },
        ];
    }
}
