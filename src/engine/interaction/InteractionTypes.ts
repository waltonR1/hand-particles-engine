import type { ShapeName } from "../particles/ShapeTypes";

// ======================================================
// InteractionEvent
// ======================================================
//
// 交互事件 = 系统的「语义层协议（Semantic Protocol）」
//
// 核心思想（IMPORTANT）：
// - Gesture / 输入系统不直接操作粒子系统
// - 只“发出事件”，表达“用户在做什么”
// - 粒子系统只关心：
//   👉 我现在收到什么语义事件？
//   👉 应该如何视觉化？
//
// 这种分层带来的好处：
// - 新增手势 ≠ 改粒子代码
// - 新增视觉效果 ≠ 改手势识别
// - InteractionEvent 成为系统内部的“稳定接口”
//
// 使用约定：
// - InteractionEvent 通常由 GestureEngine / 插件产生
// - 由 InteractionController / ParticleController 消费
// - 同一帧可以产生多个事件（数组）
//
// ======================================================

export type InteractionEvent =

/**
 * MODE：当前交互模式
 *
 * 用途：
 * - 告知系统当前是“无手 / 单手 / 双手”状态
 *
 * 典型来源：
 * - HandFrame[] 的数量
 * - 双手距离、稳定性判断
 *
 * 设计说明：
 * - 这是“状态事件”，而非一次性动作
 * - 通常每帧都会发送
 */
    | {
    type: "MODE";
    mode: "NONE" | "SINGLE" | "DUAL";
}

    /**
     * MOVE：二维平移
     *
     * 语义：
     * - 表示一个“目标位置”
     * - 而不是“位移增量”
     *
     * 坐标约定：
     * - nx, ny ∈ [0, 1]
     * - 归一化屏幕空间
     *
     * 常见来源：
     * - 单手 center
     * - 双手中心点
     */
    | {
    type: "MOVE";
    nx: number;
    ny: number;
}

    /**
     * ZOOM：缩放控制
     *
     * 语义：
     * - 表示“期望的缩放值”
     * - 而不是 delta
     *
     * 常见来源：
     * - 双手距离
     * - 单手 pinch 强度
     *
     * 注意：
     * - value 的数值范围不在这里强制
     * - 粒子系统可自行 clamp / remap
     */
    | {
    type: "ZOOM";
    value: number;
}

    /**
     * ROTATE：旋转控制
     *
     * 语义：
     * - 围绕 Z 轴的旋转角度
     * - 通常来自双手连线的方向
     *
     * 单位：
     * - 弧度（radians）
     *
     * 设计选择：
     * - 直接传 angle，而不是角速度
     */
    | {
    type: "ROTATE";
    angle: number;
}

    /**
     * SPREAD：聚散程度
     *
     * 语义：
     * - 连续值，表示“张开 / 收缩”程度
     *
     * 数值约定：
     * - value ∈ [0, 1]
     *
     * 使用场景：
     * - 粒子云的密度变化
     * - 环形的半径变化
     */
    | {
    type: "SPREAD";
    value: number;
}

    /**
     * SHAPE：目标形状切换
     *
     * 语义：
     * - 表示“希望切换到的形状”
     * - 是否平滑过渡由粒子系统决定
     *
     * 重要设计点：
     * - 这里依赖的是 ShapeName（语义）
     * - 而不是 Three.js / 几何实现
     */
    | {
    type: "SHAPE";
    name: ShapeName;
}

    /**
     * SCATTER：爆散事件
     *
     * 语义：
     * - 一次性“脉冲型”事件
     * - 不携带数值
     *
     * 使用场景：
     * - 快速甩手
     * - 强烈手势触发
     *
     * 消费方式：
     * - 粒子系统通常在收到该事件的那一帧触发效果
     */
    | {
    type: "SCATTER";
}

    /**
     * CONVERGE：吸收 / 聚合
     *
     * 语义：
     * - 与 SCATTER 语义相反
     * - 通常由“双手合拢”触发
     *
     * 特点：
     * - 可以是瞬时事件
     * - 也可以被解释为状态切换
     */
    | {
    type: "CONVERGE";
}

    /**
     * IDLE：静止程度
     *
     * 语义：
     * - 描述“当前有多静止”
     * - 并非是否 idle 的布尔判断
     *
     * 数值约定：
     * - stillness ∈ [0, 1]
     * - 1 表示几乎完全静止
     *
     * 使用场景：
     * - 自动回到默认形态
     * - 呼吸、漂浮等待机动画
     */
    | {
    type: "IDLE";
    stillness: number;
}

    /**
     * GESTURE_LABEL：手势标签
     *
     * 语义：
     * - 纯 UI / 调试用途
     * - 不参与物理或粒子计算
     *
     * 示例：
     * - "Pinch"
     * - "Swipe Left"
     * - "Dual Rotate"
     */
    | {
    type: "GESTURE_LABEL";
    label: string;
}

    /**
     * SHAKE_ENERGY：抖动能量
     *
     * 语义：
     * - 描述“手抖得有多厉害”
     *
     * 数值约定：
     * - value ∈ [0, 1]（推荐）
     *
     * 使用场景：
     * - UI 反馈
     * - 特效强度调制
     */
    | {
    type: "SHAKE_ENERGY";
    value: number;
};
