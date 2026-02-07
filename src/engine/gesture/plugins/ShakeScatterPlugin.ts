import type { GesturePlugin, GestureContext, PluginPhase } from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";
import { EMA } from "../../../utils/smoothing";

// noinspection JSUnusedGlobalSymbols
/**
 * ======================================================
 * ShakeScatterPlugin
 * ======================================================
 *
 * 单手“甩动 / 抖动” → SCATTER（爆散）插件
 *
 * 语义定位（IMPORTANT）：
 * - 只在【单手】模式下生效
 * - 通过分析“手心运动的高频能量”
 * - 判断是否发生了一次“有意的甩手动作”
 *
 * 设计目标：
 * - 区分「普通移动」 vs 「剧烈抖动」
 * - 避免误触发
 * - 爆散是“脉冲型事件”，不是连续控制
 *
 * 整体算法思路：
 * 1️⃣ 计算手心速度（vx, vy）
 * 2️⃣ 维护一个短时间速度历史
 * 3️⃣ 计算“速度变化能量”（高频成分）
 * 4️⃣ 用 EMA 平滑能量，降低噪声
 * 5️⃣ 超过阈值 + 冷却结束 → 触发 SCATTER
 * ======================================================
 */
export default class ShakeScatterPlugin implements GesturePlugin {

    /**
     * 插件名称
     */
    name = "ShakeScatter";

    /**
     * 插件执行阶段
     *
     * 说明：
     * - 抖动属于核心交互语义
     * - 放在 main 阶段
     */
    phase: PluginPhase = "main";

    /**
     * 插件优先级
     *
     * 说明：
     * - 30：低于 MODE / DUAL / SPREAD 等基础插件
     * - 避免过早抢占语义
     */
    priority = 30;

    /**
     * 上一帧手心位置（归一化坐标）
     *
     * 用途：
     * - 用于计算速度
     *
     * 注意：
     * - 插件是有状态的
     * - 不应在多输入源间复用同一个实例
     */
    private prevX = 0;
    private prevY = 0;

    /**
     * 速度历史缓冲区
     *
     * 内容：
     * - 每一帧的速度标量 |v|
     *
     * 长度：
     * - 最多 8 帧
     *
     * 设计动机：
     * - 用于估计“速度变化的剧烈程度”
     * - 而不是速度本身
     */
    private history: number[] = [];

    /**
     * 能量的指数滑动平均
     *
     * alpha = 0.35：
     * - 对突发抖动较敏感
     * - 又不会完全跟随噪声
     */
    private energyEma = new EMA(0.35);

    /**
     * 冷却时间（秒）
     *
     * 作用：
     * - 防止连续多次触发 SCATTER
     * - 把爆散限制为“明显的、离散的动作”
     */
    private cooldown = 0;

    /**
     * update：抖动检测核心逻辑
     *
     * @param frames 当前帧手数据
     * @param ctx 时间上下文（dt / time）
     *
     * @returns InteractionEvent[]
     */
    update(frames: HandFrame[], ctx: GestureContext): InteractionEvent[] {

        // ==========================
        // 前置条件：仅在单手模式下生效
        // ==========================
        if (frames.length !== 1) return [];

        const h = frames[0];

        /**
         * dt 防御性处理
         *
         * 原因：
         * - 极端情况下 dt 可能为 0
         * - 避免除零导致速度爆炸
         */
        const dt = Math.max(ctx.dt, 1e-3);

        /**
         * 计算手心速度（归一化坐标 / 秒）
         */
        const vx = (h.center.x - this.prevX) / dt;
        const vy = (h.center.y - this.prevY) / dt;

        // 更新上一帧位置
        this.prevX = h.center.x;
        this.prevY = h.center.y;

        /**
         * 速度标量
         *
         * 注意：
         * - 这里只关心“快不快”
         * - 不关心方向
         */
        const v = Math.hypot(vx, vy);

        // ==========================
        // 维护速度历史
        // ==========================
        this.history.push(v);
        if (this.history.length > 8) this.history.shift();

        /**
         * 能量计算（高频成分）
         *
         * 计算方式：
         * - 对相邻帧速度做差
         * - 再取绝对值并求平均
         *
         * 直觉解释：
         * - 平稳移动：速度变化小 → 能量低
         * - 剧烈抖动：速度忽快忽慢 → 能量高
         */
        let energy = 0;
        for (let i = 1; i < this.history.length; i++) {
            energy += Math.abs(
                this.history[i] - this.history[i - 1]
            );
        }
        energy /= this.history.length;

        /**
         * 使用 EMA 平滑能量
         *
         * 目的：
         * - 抑制单帧尖峰
         * - 更接近“人类感知的抖动强度”
         */
        const e = this.energyEma.update(energy);

        /**
         * 冷却递减
         */
        this.cooldown = Math.max(0, this.cooldown - dt);

        /**
         * 触发条件：
         * - 冷却结束
         * - 平滑能量超过经验阈值
         *
         * e > 2.2：
         * - 经验值
         * - 需要结合摄像头分辨率、帧率微调
         */
        if (this.cooldown <= 0 && e > 2.2) {

            // 进入冷却期（1 秒）
            this.cooldown = 1;

            // 触发一次爆散（脉冲事件）
            return [{ type: "SCATTER" }];
        }

        return [];
    }
}
