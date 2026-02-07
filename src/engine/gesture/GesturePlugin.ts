import type { HandFrame } from "../input/types/GestureTypes";
import type { InteractionEvent } from "../interaction/InteractionTypes";

/**
 * ======================================================
 * GestureContext
 * ======================================================
 *
 * GestureContext：插件执行时的“时间上下文”
 *
 * 设计目的：
 * - 为所有 GesturePlugin 提供统一的时间信息
 * - 避免插件各自维护 time / dt，导致不一致
 *
 * 这是一个“只读上下文”：
 * - 插件不应修改 ctx
 * - 插件只基于 ctx 计算事件
 */
export type GestureContext = {

    /**
     * dt：delta time
     *
     * 含义：
     * - 当前帧与上一帧之间的时间差
     *
     * 单位：
     * - 秒（seconds）
     *
     * 使用场景：
     * - 速度 / 能量 / 抖动计算
     * - 与帧率无关的阈值判断
     */
    dt: number;

    /**
     * time：绝对时间
     *
     * 含义：
     * - 从系统启动或时间轴起点开始的累计时间
     *
     * 单位：
     * - 秒（seconds）
     *
     * 使用场景：
     * - 周期函数（sin / cos）
     * - 手势持续时间判断
     * - 调试 / 记录
     */
    time: number;
};


/**
 * ======================================================
 * PluginPhase
 * ======================================================
 *
 * PluginPhase：插件执行阶段
 *
 * 设计目的（IMPORTANT）：
 * - 允许插件在“不同语义阶段”参与计算
 * - 避免所有插件挤在同一层级互相干扰
 *
 * 三个阶段的语义约定：
 *
 * - "before"
 *   → 预处理阶段
 *   → 常用于：
 *     - 输入修正
 *     - 全局状态探测
 *     - 抑制 / 过滤某些情况
 *
 * - "main"
 *   → 主识别阶段（默认）
 *   → 大多数手势逻辑应放在这里
 *
 * - "after"
 *   → 后处理阶段
 *   → 常用于：
 *     - 派生事件（如 label / UI 提示）
 *     - 修饰性、非核心语义
 */
export type PluginPhase = "before" | "main" | "after";


/**
 * ======================================================
 * GesturePlugin
 * ======================================================
 *
 * GesturePlugin：手势识别插件接口
 *
 * 核心思想：
 * - 每个插件只关注“一种手势 / 一类特征”
 * - 插件之间不直接通信
 * - 所有输出都通过 InteractionEvent 表达
 *
 * 这是一个“声明式 + 事件驱动”的插件协议
 */
export interface GesturePlugin {

    /**
     * 插件名称
     *
     * 用途：
     * - 调试
     * - 日志
     * - UI 显示
     *
     * 约定：
     * - 应在系统内唯一
     */
    name: string;

    /**
     * 插件优先级（可选）
     *
     * 语义：
     * - 数值越小 → 越早执行
     * - 用于同一 phase 内的排序
     *
     * 使用场景：
     * - 基础插件（如模式判断） → 高优先级
     * - 修饰插件（如 UI 标签） → 低优先级
     */
    priority?: number;

    /**
     * 插件是否启用（可选）
     *
     * 语义：
     * - false → 插件被跳过
     * - true / undefined → 正常执行
     *
     * 使用场景：
     * - 调试开关
     * - 动态启停某类手势
     */
    enabled?: boolean;

    /**
     * 插件执行阶段（可选）
     *
     * 默认行为（隐式约定）：
     * - 若未指定，通常视为 "main"
     *
     * 设计动机：
     * - 明确插件在整体流程中的“角色”
     */
    phase?: PluginPhase;

    /**
     * update：插件核心逻辑
     *
     * 输入：
     * - frames：当前帧检测到的所有手（0 / 1 / 2）
     * - ctx：时间上下文（dt / time）
     *
     * 输出：
     * - InteractionEvent 数组
     * - 可以返回：
     *   - []            → 本帧无相关事件
     *   - [event]       → 单一事件
     *   - [event, ...]  → 多个语义事件
     *
     * 重要约定（IMPORTANT）：
     * - 插件不应修改 frames
     * - 插件不应依赖其它插件的内部状态
     * - 插件只通过事件“声明意图”
     */
    update(
        frames: HandFrame[],
        ctx: GestureContext
    ): InteractionEvent[];
}
