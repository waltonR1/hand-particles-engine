# Hand Particles Engine

> 一个基于 **摄像头手势识别（MediaPipe）** 的
> **实时粒子交互引擎**
>
> 手势 → 语义 → 状态 → 视觉
>
> **强解耦 · 插件化 · 可扩展**

---

## ✨ 功能概览

* 🎥 **实时手部追踪**（支持单手 / 双手）
* 🧠 **插件化手势语义系统**
* 🧩 **事件 → 状态 → 视觉** 的清晰数据流
* ✨ **高性能粒子系统（18k 粒子）**
* 🎛 **实时 UI 调试面板**
* 🔌 **插件可动态启用 / 禁用**

---

## 🧠 核心设计理念

### 1️⃣ 分层，而不是堆逻辑

系统被严格拆分为 **5 层**，每一层只做一件事：

```
[ Camera / MediaPipe ]
          ↓
     HandTracker
          ↓ HandFrame[]
     GestureEngine
          ↓ InteractionEvent[]
   InteractionCore
          ↓ InteractionState
   ParticleSystem
          ↓
        Three.js
```

> **上层永远不知道下层如何实现，下层永远不反向依赖上层**

---

### 2️⃣ 语义优先，而不是直接控制

❌ 错误做法（被刻意避免）：

```ts
if (pinch) particles.scatter();
```

✅ 本项目的做法：

```ts
{ type: "SCATTER" }
```

* 手势系统 **只声明“发生了什么”**
* 粒子系统 **决定“视觉上怎么表现”**

---

### 3️⃣ 插件是“事件产生者”，不是控制器

每个插件都遵循同一个原则：

> **HandFrame + 时间 → InteractionEvent[]**

插件：

* 不操作 Three.js
* 不修改全局状态
* 不知道其它插件存在

---

## 📁 项目结构

```text
src/
├── app/
│   └── ThreeApp.ts            # Three.js 壳层（scene / camera / render loop）
│
├── engine/
│   ├── input/
│   │   └── HandTracker.ts     # 摄像头 + MediaPipe → HandFrame[]
│   │
│   ├── gesture/
│   │   ├── GestureEngine.ts   # 插件调度器
│   │   ├── GesturePlugin.ts   # 插件接口定义
│   │   └── plugins/           # 所有手势插件
│   │
│   ├── interaction/
│   │   └── InteractionCore.ts # 事件 → 统一状态
│   │
│   └── particles/
│       ├── ParticleSystem.ts  # 粒子动力学
│       ├── ShapeFactory.ts    # 形状生成
│       └── ShapeTypes.ts
│
├── ui/
│   └── UI.ts                  # 调试 / 控制面板
│
└── main.ts                     # 应用入口（胶水层）
```

---

## 🧩 Gesture Plugin 系统

### 插件接口

```ts
interface GesturePlugin {
  name: string;
  phase?: "before" | "main" | "after";
  priority?: number;
  enabled?: boolean;

  update(
    frames: HandFrame[],
    ctx: { dt: number; time: number }
  ): InteractionEvent[];
}
```

---

### 插件执行顺序

插件执行顺序 = **phase + priority**

```text
before  →  main  →  after
```

同一 phase 内：

```
priority 数值越小 → 越早执行
```

---

### 内置插件一览

| 插件名              | 作用              |
| ---------------- | --------------- |
| `GestureLabel`   | 离散手势标签（UI / 调试） |
| `DualHand`       | 双手：缩放 / 旋转 / 聚散 |
| `SingleHandMove` | 单手：平移 + 基础缩放    |
| `PinchSpread`    | 单手 pinch → 连续聚散 |
| `ShakeScatter`   | 单手甩动 → 爆散       |
| `GestureShape`   | 手势状态 → 形状选择     |

---

## 🧠 Interaction Core（语义归并）

### 为什么需要这一层？

插件输出的是 **离散事件**：

```ts
{ type: "ZOOM", value: 1.4 }
{ type: "SCATTER" }
```

而粒子系统需要的是 **连续、完整的状态**：

```ts
{
  zoom: 1.23,
  spread: 0.42,
  scatter: false,
  rotation: 0.18,
  ...
}
```

👉 **InteractionCore 负责把“事件流”变成“稳定状态”**

---

### 脉冲 vs 连续

| 类型 | 示例                       |
| -- | ------------------------ |
| 连续 | `zoom`, `panX`, `spread` |
| 脉冲 | `scatter`, `converge`    |

脉冲事件：

* 每帧自动清零
* 只在当前帧有效

---

## ✨ Particle System（视觉动力学）

### 核心特点

* CPU 更新 + GPU 渲染
* 指数插值（与帧率无关）
* 爆散 / 聚散 / 呼吸 动力学模型
* 所有形状预生成（零运行时分配）

### 关键原则

> **ParticleSystem 只消费 InteractionState**

它：

* 不知道手势
* 不知道插件
* 不知道 UI

---

## 🎛 UI 系统

### 功能

* 显示当前状态
* 摄像头 / 骨架调试预览
* 粒子颜色调节
* 插件启用 / 禁用
* 全屏切换

### 设计原则

* UI 永远是 **被动的**
* 只通过 callback 通信
* 不直接操作引擎内部状态

---

## ▶️ 启动方式

### 环境要求

* HTTPS 或 `localhost`
* 浏览器允许摄像头权限

### 启动流程

```ts
npm install
npm run dev
```

打开浏览器，允许摄像头权限即可。