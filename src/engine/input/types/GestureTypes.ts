// 手部数据结构：尽量轻量、可扩展（以后可加 handedness / worldLandmarks 等）
export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };

export type HandFrame = {
    // 21 个关键点（归一化 0..1，z 为相对深度）
    landmarks: Vec3[];

    // 手心/手掌中心（归一化）
    center: Vec2;

    // 手大小（用 wrist 到 middle_tip 的距离近似，归一化）
    size: number;

    // pinch 程度：0 张开 ~ 1 捏紧（thumb_tip 与 index_tip）
    pinch: number;

    // 时间戳（秒）
    t: number;

    // 可选：左右手（如果能从模型结果里取到）
    handedness?: "Left" | "Right";
};
