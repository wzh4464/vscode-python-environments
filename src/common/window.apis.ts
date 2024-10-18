import {
    CancellationToken,
    Disposable,
    ExtensionTerminalOptions,
    QuickInputButtons,
    QuickPick,
    QuickPickItem,
    QuickPickItemButtonEvent,
    QuickPickOptions,
    StatusBarAlignment,
    StatusBarItem,
    Terminal,
    TerminalOptions,
    TerminalShellExecutionEndEvent,
    TerminalShellIntegrationChangeEvent,
    TextEditor,
    Uri,
    window,
} from 'vscode';
import { createDeferred } from './utils/deferred';

export function createStatusBarItem(id: string, alignment?: StatusBarAlignment, priority?: number): StatusBarItem {
    return window.createStatusBarItem(id, alignment, priority);
}

export function createTerminal(options: ExtensionTerminalOptions | TerminalOptions): Terminal {
    return window.createTerminal(options);
}

export function onDidChangeTerminalShellIntegration(
    listener: (e: TerminalShellIntegrationChangeEvent) => any,
    thisArgs?: any,
    disposables?: Disposable[],
): Disposable {
    return window.onDidChangeTerminalShellIntegration(listener, thisArgs, disposables);
}

export function terminals(): readonly Terminal[] {
    return window.terminals;
}

export function activeTerminal(): Terminal | undefined {
    return window.activeTerminal;
}

export function onDidEndTerminalShellExecution(
    listener: (e: TerminalShellExecutionEndEvent) => any,
    thisArgs?: any,
    disposables?: Disposable[],
): Disposable {
    return window.onDidEndTerminalShellExecution(listener, thisArgs, disposables);
}

export function onDidOpenTerminal(
    listener: (terminal: Terminal) => any,
    thisArgs?: any,
    disposables?: Disposable[],
): Disposable {
    return window.onDidOpenTerminal(listener, thisArgs, disposables);
}

export function onDidCloseTerminal(
    listener: (terminal: Terminal) => any,
    thisArgs?: any,
    disposables?: Disposable[],
): Disposable {
    return window.onDidCloseTerminal(listener, thisArgs, disposables);
}

export function showTextDocument(uri: Uri): Thenable<TextEditor> {
    return window.showTextDocument(uri);
}

export async function showQuickPickWithButtons<T extends QuickPickItem>(
    items: readonly T[],
    options?: QuickPickOptions & { showBackButton?: boolean },
    token?: CancellationToken,
    itemButtonHandler?: (e: QuickPickItemButtonEvent<T>) => void,
): Promise<T | T[] | undefined> {
    const quickPick: QuickPick<T> = window.createQuickPick<T>();
    const disposables: Disposable[] = [quickPick];

    quickPick.items = items;
    if (options?.showBackButton) {
        quickPick.buttons = [QuickInputButtons.Back];
    }
    quickPick.canSelectMany = options?.canPickMany ?? false;
    quickPick.ignoreFocusOut = options?.ignoreFocusOut ?? false;
    quickPick.matchOnDescription = options?.matchOnDescription ?? false;
    quickPick.matchOnDetail = options?.matchOnDetail ?? false;
    quickPick.placeholder = options?.placeHolder;
    quickPick.title = options?.title;

    const deferred = createDeferred<T | T[] | undefined>();

    disposables.push(
        quickPick,
        quickPick.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
                deferred.reject(QuickInputButtons.Back);
                quickPick.hide();
            }
        }),
        quickPick.onDidAccept(() => {
            if (!deferred.completed) {
                if (quickPick.canSelectMany) {
                    deferred.resolve(quickPick.selectedItems.map((item) => item));
                } else {
                    deferred.resolve(quickPick.selectedItems[0]);
                }

                quickPick.hide();
            }
        }),
        quickPick.onDidHide(() => {
            if (!deferred.completed) {
                deferred.resolve(undefined);
            }
        }),
        quickPick.onDidTriggerItemButton((e) => {
            if (itemButtonHandler) {
                itemButtonHandler(e);
            }
        }),
    );
    if (token) {
        disposables.push(
            token.onCancellationRequested(() => {
                quickPick.hide();
            }),
        );
    }
    quickPick.show();

    try {
        return await deferred.promise;
    } finally {
        disposables.forEach((d) => d.dispose());
    }
}
