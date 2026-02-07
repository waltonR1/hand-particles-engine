import type { GesturePlugin, GestureContext, PluginPhase } from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";

// noinspection JSUnusedGlobalSymbols
/**
 * ======================================================
 * SingleHandMovePlugin
 * ======================================================
 *
 * 单手“平移 + 基础缩放”插件
 *
 * 语义定位（IMPORTANT）：
 * - 这是单手交互的“基础插件”
 * - 只要系统处于单手状态，它就持续地产生核心语义事件
 *
 * 本插件负责的语义：
 * - MODE  → SINGLE
 * - MOVE  → 手心位置映射为平移
 * - ZOOM  → 基于手大小的基础缩放
 *
 * 设计原则：
 * - 不做复杂判断
 * - 不做平滑
 * - 不关心视觉效果
 *
 * 只负责把“单手的几何状态”翻译成“稳定、连续的语义事件”
 * ======================================================
 */
export default class SingleHandMovePlugin implements GesturePlugin {

    /**
     * 插件名称
     *
     * 用途：
     * - GestureEngine 中的启停控制
     * - 调试 / UI 展示
     */
    name = "SingleHandMove";

    /**
     * 插件执行阶段
     *
     * 说明：
     * - 单手平移与缩放属于核心交互语义
     * - 放在 main 阶段
     */
    phase: PluginPhase = "main";

    /**
     * 插件优先级
     *
     * 说明：
     * - 10：高于 SPREAD / SHAKE 等派生插件
     * - 低于 DUAL 模式判断（priority = 5）
     *
     * 这样可以保证：
     * - MODE: SINGLE 尽早被声明
     * - 后续插件可以基于 SINGLE 模式工作
     */
    priority = 10;

    /**
     * update：单手基础交互逻辑
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
        // - 0 手 / 双手 → 交由其它插件处理
        //
        if (frames.length !== 1) return [];

        const h = frames[0];

        /**
         * 输出的语义事件
         *
         * 事件组合说明（IMPORTANT）：
         *
         * 1️⃣ MODE: SINGLE
         * - 明确告诉系统：当前是单手交互
         *
         * 2️⃣ MOVE
         * - 使用手心中心点
         * - nx / ny 为归一化坐标（0..1）
         * - 映射到世界坐标由 InteractionCore 负责
         *
         * 3️⃣ ZOOM
         * - 使用手的 size（近似手在画面中的大小）
         * - value = 0.8 + h.size
         *
         * 直觉解释：
         * - 手靠近摄像头 → size 大 → 放大
         * - 手远离摄像头 → size 小 → 缩小
         *
         * 0.8 是一个经验偏置：
         * - 防止 size 较小时缩放过小
         */
        return [
            { type: "MODE", mode: "SINGLE" },

            // 单手平移：直接跟随手心
            { type: "MOVE", nx: h.center.x, ny: h.center.y },

            // 单手缩放：由手大小决定
            { type: "ZOOM", value: 0.8 + h.size },
        ];
    }
}
