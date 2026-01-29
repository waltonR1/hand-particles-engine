import type {GesturePlugin, GestureContext, PluginPhase} from "../GesturePlugin";
import type { InteractionEvent } from "../../interaction/InteractionTypes";
import type { HandFrame } from "../../input/types/GestureTypes";
import { EMA } from "../../../utils/smoothing";

// noinspection JSUnusedGlobalSymbols
export default class ShakeScatterPlugin implements GesturePlugin {
    name = "ShakeScatter";
    phase:PluginPhase = "main";
    priority = 30;


    private prevX = 0;
    private prevY = 0;
    private history: number[] = [];
    private energyEma = new EMA(0.35);
    private cooldown = 0;

    update(frames: HandFrame[], ctx: GestureContext): InteractionEvent[] {
        if (frames.length !== 1) return [];

        const h = frames[0];
        const dt = Math.max(ctx.dt, 1e-3);

        const vx = (h.center.x - this.prevX) / dt;
        const vy = (h.center.y - this.prevY) / dt;

        this.prevX = h.center.x;
        this.prevY = h.center.y;

        const v = Math.hypot(vx, vy);

        this.history.push(v);
        if (this.history.length > 8) this.history.shift();

        let energy = 0;
        for (let i = 1; i < this.history.length; i++) {
            energy += Math.abs(this.history[i] - this.history[i - 1]);
        }
        energy /= this.history.length;

        const e = this.energyEma.update(energy);
        this.cooldown = Math.max(0, this.cooldown - dt);

        if (this.cooldown <= 0 && e > 2.2) {
            this.cooldown = 1;
            return [{ type: "SCATTER" }];
        }

        return [];
    }
}
