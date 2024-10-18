import {
    CancellationToken,
    ConfigurationChangeEvent,
    ConfigurationScope,
    Disposable,
    GlobPattern,
    Uri,
    workspace,
    WorkspaceConfiguration,
    WorkspaceFolder,
    WorkspaceFoldersChangeEvent,
} from 'vscode';

export function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined {
    return workspace.getWorkspaceFolder(uri);
}

export function getWorkspaceFolders(): readonly WorkspaceFolder[] | undefined {
    return workspace.workspaceFolders;
}

export function getConfiguration(section?: string, scope?: ConfigurationScope | null): WorkspaceConfiguration {
    return workspace.getConfiguration(section, scope);
}

export function onDidChangeConfiguration(listener: (e: ConfigurationChangeEvent) => any): Disposable {
    return workspace.onDidChangeConfiguration(listener);
}

export function onDidChangeWorkspaceFolders(listener: (e: WorkspaceFoldersChangeEvent) => any): Disposable {
    return workspace.onDidChangeWorkspaceFolders(listener);
}

export function findFiles(
    include: GlobPattern,
    exclude?: GlobPattern | null,
    maxResults?: number,
    token?: CancellationToken,
): Thenable<Uri[]> {
    return workspace.findFiles(include, exclude, maxResults, token);
}
