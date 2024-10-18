export interface SimpleDebounce {
    trigger(): void;
}

class SimpleDebounceImpl {
    private timeout: NodeJS.Timeout | undefined;

    constructor(private readonly delay: number, private readonly callback: () => void) {}

    public trigger() {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => {
            this.callback();
        }, this.delay);
    }
}

export function createSimpleDebounce(delay: number, callback: () => void): SimpleDebounce {
    return new SimpleDebounceImpl(delay, callback);
}
