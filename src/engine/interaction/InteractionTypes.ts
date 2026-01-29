import type { ShapeName } from "../particles/ShapeTypes";

// 交互事件：系统的“语义层”，以后加新动作就加新 event，不动粒子系统
export type InteractionEvent =
    | { type: "MODE"; mode: "NONE" | "SINGLE" | "DUAL" }
    | { type: "MOVE"; nx: number; ny: number }        // 归一化位置 0..1
    | { type: "ZOOM"; value: number }                 // 目标缩放
    | { type: "ROTATE"; angle: number }               // Z 轴旋转（双手角度）
    | { type: "SPREAD"; value: number }               // 聚散 0..1
    | { type: "SHAPE"; name: ShapeName }              // 目标形状
    | { type: "SCATTER" }                             // 爆散一次（脉冲）
    | { type: "CONVERGE" }                            // 吸收（双手合拢）
    | { type: "IDLE"; stillness: number }             // 静止程度 0..1
    | { type: "GESTURE_LABEL"; label: string }        // 便于 UI 展示
    | { type: "SHAKE_ENERGY"; value: number };        // 便于 UI 展示
