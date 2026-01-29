// 形状类型：作为共享类型，避免 interaction <-> particles 循环依赖
export type ShapeName =
    | "SPHERE"
    | "CUBE"
    | "TORUSKNOT"
    | "WAVE"
    | "RING"
    | "HEART"
    | "TEXT";
