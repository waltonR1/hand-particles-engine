import type { GesturePlugin, GestureContext, PluginPhase } from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";

// noinspection JSUnusedGlobalSymbols
/**
 * ======================================================
 * DualHandPlugin
 * ======================================================
 *
 * 双手交互插件
 *
 * 语义定位（IMPORTANT）：
 * - 当同时检测到两只手时：
 *   - 系统进入 DUAL 模式
 *   - 双手之间的“相对几何关系”决定交互语义
 *
 * 本插件负责产生的语义事件：
 * - MODE    → DUAL
 * - ZOOM    → 由双手距离决定
 * - ROTATE  → 由双手连线方向决定
 * - CONVERGE / SCATTER → 由距离阈值触发的脉冲事件
 *
 * 注意：
 * - 本插件不做任何平滑
 * - 所有“连续性 / 动力学”都交给 ParticleSystem
 * ======================================================
 */
export default class DualHandPlugin implements GesturePlugin {

    /**
     * 插件名称
     *
     * 用途：
     * - 调试
     * - UI 展示
     * - GestureEngine 中的启停控制
     */
    name = "DualHand";

    /**
     * 插件执行阶段
     *
     * 说明：
     * - 双手语义属于“核心交互逻辑”
     * - 放在 main 阶段执行
     */
    phase: PluginPhase = "main";

    /**
     * 插件优先级
     *
     * 说明：
     * - 数值越小，执行越早
     * - 5 属于较高优先级
     *
     * 设计动机：
     * - 希望 DUAL 模式尽早被识别
     * - 以便后续插件（如 UI 标签）基于该模式工作
     */
    priority = 5;

    /**
     * update：双手语义识别核心
     *
     * @param frames 当前帧所有检测到的手
     * @param _ctx 时间上下文（此插件暂未使用）
     *
     * @returns InteractionEvent[]
     */
    update(frames: HandFrame[], _ctx: GestureContext): InteractionEvent[] {

        // ==========================
        // 前置条件：必须至少有两只手
        // ==========================
        if (frames.length < 2) return [];

        /**
         * 取前两只手
         *
         * 隐式约定（IMPORTANT）：
         * - frames 已在 HandTracker 中按 handedness 排序
         * - 这里不区分 Left / Right
         * - 只关心“两只手之间的相对关系”
         */
        const [a, b] = frames;

        /**
         * 双手中心点之间的向量
         *
         * dx, dy：
         * - 在归一化屏幕坐标系下
         */
        const dx = a.center.x - b.center.x;
        const dy = a.center.y - b.center.y;

        /**
         * 双手距离
         *
         * 语义：
         * - 描述双手张开 / 合拢程度
         * - 是整个双手交互的“核心连续变量”
         */
        const dist = Math.hypot(dx, dy);

        /**
         * 输出的语义事件列表
         *
         * 事件组合说明（IMPORTANT）：
         *
         * 1️⃣ MODE: DUAL
         * - 明确告诉系统：当前是双手交互
         *
         * 2️⃣ ZOOM
         * - 使用双手距离映射缩放
         * - value = 0.6 + dist * 3
         *
         *   这是一个“经验映射”：
         *   - dist 小 → 缩放偏小
         *   - dist 大 → 缩放偏大
         *
         * 3️⃣ ROTATE
         * - 使用双手连线的方向角
         * - atan2(dy, dx) ∈ [-π, π]
         *
         * 4️⃣ CONVERGE（脉冲）
         * - 当双手非常接近时触发
         * - dist < 0.12
         *
         * 5️⃣ SCATTER（脉冲）
         * - 当双手非常张开时触发
         * - dist > 0.6
         *
         * 注意：
         * - CONVERGE / SCATTER 是互斥但不强制
         * - 它们是“瞬时语义”，由 InteractionCore / ParticleSystem 解释
         */
        return [
            { type: "MODE", mode: "DUAL" },

            // 双手距离 → 缩放值
            { type: "ZOOM", value: 0.6 + dist * 3 },

            // 双手方向 → 旋转角
            { type: "ROTATE", angle: Math.atan2(dy, dx) },

            // 双手非常接近 → 吸收 / 聚合
            ...(dist < 0.12
                ? [{ type: "CONVERGE" as const }]
                : []),

            // 双手非常张开 → 爆散
            ...(dist > 0.6
                ? [{ type: "SCATTER" as const }]
                : []),
        ];
    }
}
