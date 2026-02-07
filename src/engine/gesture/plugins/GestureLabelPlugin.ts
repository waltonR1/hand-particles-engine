import type { GesturePlugin, PluginPhase } from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";

/**
 * GestureName
 *
 * 系统内部使用的“离散手势标签集合”
 *
 * 设计原则：
 * - 用于 UI / 调试 / 状态展示
 * - 不直接驱动粒子物理（与 InteractionEvent 解耦）
 *
 * 注意：
 * - 这是“标签（label）”，不是“命令（command）”
 */
type GestureName =
    | "NONE"
    | "OPEN_PALM"
    | "FIST"
    | "V_SIGN"
    | "OK_SIGN"
    | "PINCH"
    | "DUAL_HANDS";

// noinspection JSUnusedGlobalSymbols
/**
 * ======================================================
 * GestureLabelPlugin
 * ======================================================
 *
 * 离散手势标签识别插件
 *
 * 插件定位（IMPORTANT）：
 * - 只负责“识别并输出手势名称”
 * - 不控制任何交互逻辑
 * - 不影响粒子状态
 *
 * 输出：
 * - InteractionEvent { type: "GESTURE_LABEL" }
 *
 * 设计目标：
 * - 为 UI / 调试提供稳定、可读的手势标签
 * - 抗抖动、抗误判
 *
 * 为什么放在 phase = "before"？
 * - 希望手势标签在“最早阶段”被计算
 * - 后续插件可以选择参考（虽然目前未使用）
 * ======================================================
 */
export default class GestureLabelPlugin implements GesturePlugin {

    /**
     * 插件名称
     */
    name = "GestureLabel";

    /**
     * 插件执行阶段
     *
     * before 阶段说明：
     * - 不参与核心交互
     * - 更像是“观测器 / 解释器”
     */
    phase: PluginPhase = "before";

    /**
     * 插件优先级
     *
     * 0 = 非常高
     * - 保证在 before 阶段最早执行
     */
    priority = 0;

    // ==================================================
    // 手势稳定机制（时间维度）
    // ==================================================

    /**
     * lastGesture：
     * - 当前“已确认”的稳定手势
     * - 对外输出的标签
     */
    private lastGesture: GestureName = "NONE";

    /**
     * candidate：
     * - 当前候选手势
     * - 尚未达到稳定条件
     */
    private candidate: GestureName = "NONE";

    /**
     * holdFrames：
     * - candidate 连续出现的帧数
     */
    private holdFrames = 0;

    /**
     * HOLD_THRESHOLD：
     * - 至少连续多少帧，才认定手势切换成立
     *
     * 经验值说明：
     * - 4 帧 ≈ 130ms（30FPS 下）
     * - 在“稳定性”和“响应性”之间折中
     */
    private readonly HOLD_THRESHOLD = 4;

    // ==================================================
    // PINCH 滞回机制（数值维度）
    // ==================================================

    /**
     * pinchActive：
     * - 当前是否处于 PINCH 状态
     *
     * 用途：
     * - 实现滞回（hysteresis）
     * - 防止 pinch 在阈值附近来回抖动
     */
    private pinchActive = false;

    /**
     * update：每帧识别并输出一个稳定的手势标签
     *
     * @param frames 当前帧的手数据
     *
     * @returns InteractionEvent[]
     */
    update(frames: HandFrame[]): InteractionEvent[] {

        // ==========================
        // 情况 1：无手
        // ==========================
        if (frames.length === 0) {
            this.lastGesture = "NONE";
            return [{ type: "GESTURE_LABEL", label: "NONE" }];
        }

        // ==========================
        // 情况 2：双手（强制优先）
        // ==========================
        //
        // 设计说明：
        // - 双手语义优先级最高
        // - 不进入单手分类逻辑
        //
        if (frames.length >= 2) {
            this.lastGesture = "DUAL_HANDS";
            return [{ type: "GESTURE_LABEL", label: "DUAL_HANDS" }];
        }

        // ==========================
        // 情况 3：单手 → 分类
        // ==========================
        const raw = this.classify(frames[0]);

        // ==================================================
        // 手势锁定缓冲（抗抖动）
        // ==================================================
        //
        // 思路：
        // - 不立即切换 lastGesture
        // - 需要 raw 连续多帧一致
        //
        if (raw === this.lastGesture) {
            // 与当前稳定状态一致 → 直接确认
            this.candidate = raw;
            this.holdFrames = 0;
        } else {
            if (raw === this.candidate) {
                // 候选保持一致 → 累积帧数
                this.holdFrames++;
                if (this.holdFrames >= this.HOLD_THRESHOLD) {
                    // 达到阈值 → 正式切换
                    this.lastGesture = raw;
                    this.holdFrames = 0;
                }
            } else {
                // 新候选出现 → 重置计数
                this.candidate = raw;
                this.holdFrames = 1;
            }
        }

        return [{ type: "GESTURE_LABEL", label: this.lastGesture }];
    }

    // ==================================================
    // 手势分类逻辑（单帧、无状态）
    // ==================================================

    /**
     * classify：对单帧 HandFrame 进行原始手势分类
     *
     * 注意：
     * - 本函数“允许不稳定”
     * - 稳定性由 update() 外层机制保证
     */
    private classify(h: HandFrame): GestureName {
        const lm = h.landmarks as any[];
        const pinch = h.pinch;

        // ==========================
        // PINCH（最高优先级）
        // ==========================
        //
        // 设计说明：
        // - PINCH 是一个强语义动作
        // - 使用滞回，避免频繁进出
        //
        if (this.checkPinch(pinch)) return "PINCH";

        // ==========================
        // 手指伸展状态判断
        // ==========================
        const extended = {
            index: this.isFingerExtended(lm, 6, 7, 8),
            middle: this.isFingerExtended(lm, 10, 11, 12),
            ring: this.isFingerExtended(lm, 14, 15, 16),
            pinky: this.isFingerExtended(lm, 18, 19, 20),
            thumb: this.isThumbExtended(lm),
        };

        // 非拇指伸展数量
        const extCount =
            (extended.index ? 1 : 0) +
            (extended.middle ? 1 : 0) +
            (extended.ring ? 1 : 0) +
            (extended.pinky ? 1 : 0);

        // ==========================
        // OK 手势
        // ==========================
        //
        // 条件：
        // - 食指伸展
        // - pinch 较强
        // - 其余手指至少 3 个伸展（容错）
        //
        if (extended.index && pinch > 0.28 && extCount >= 3)
            return "OK_SIGN";

        // ==========================
        // FIST（握拳）
        // ==========================
        if (extCount === 0 && !extended.thumb)
            return "FIST";

        // ==========================
        // V_SIGN（剪刀手，容错版）
        // ==========================
        if (
            extended.index &&
            extended.middle &&
            !extended.ring &&
            (extended.pinky ? pinch < 0.2 : true)
        )
            return "V_SIGN";

        // ==========================
        // OPEN_PALM（张开手掌）
        // ==========================
        if (extCount >= 3)
            return "OPEN_PALM";

        // ==========================
        // 默认：保持旧手势（防抖）
        // ==========================
        return this.lastGesture;
    }

    /**
     * checkPinch：PINCH 滞回检测
     *
     * 滞回逻辑：
     * - 进入阈值：pinch > 0.82
     * - 退出阈值：pinch < 0.65
     *
     * 好处：
     * - 防止在边界附近反复切换
     */
    private checkPinch(pinch: number) {
        if (this.pinchActive) {
            if (pinch < 0.65) this.pinchActive = false;
        } else {
            if (pinch > 0.82) this.pinchActive = true;
        }
        return this.pinchActive;
    }

    /**
     * isFingerExtended：判断非拇指是否伸展
     *
     * 逻辑：
     * - 指尖 / DIP 的 y 坐标
     * - 是否高于 PIP（更靠上）
     *
     * 注意：
     * - 依赖 MediaPipe Hands 的坐标系
     * - y 越小越靠上
     */
    private isFingerExtended(
        lm: any[],
        pip: number,
        dip: number,
        tip: number
    ) {
        return lm[tip].y < lm[pip].y && lm[dip].y < lm[pip].y;
    }

    /**
     * isThumbExtended：判断拇指是否伸展
     *
     * 使用 x 轴差值：
     * - 拇指主要在水平方向张开
     *
     * 0.06 是经验阈值
     */
    private isThumbExtended(lm: any[]) {
        return Math.abs(lm[4].x - lm[2].x) > 0.06;
    }
}
