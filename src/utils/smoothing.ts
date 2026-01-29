// 指数滑动平均（EMA），用于平滑手势数据（更稳定）
export class EMA {
    private inited = false;
    private value: number = 0;

    constructor(private alpha: number) {}

    update(x: number): number {
        if (!this.inited) {
            this.value = x;
            this.inited = true;
            return this.value;
        }
        this.value = this.alpha * x + (1 - this.alpha) * this.value;
        return this.value;
    }

    get(): number {
        return this.value;
    }
}
