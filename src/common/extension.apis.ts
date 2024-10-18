import { Extension, extensions } from 'vscode';

export function getExtension<T = any>(extensionId: string): Extension<T> | undefined {
    return extensions.getExtension(extensionId);
}
