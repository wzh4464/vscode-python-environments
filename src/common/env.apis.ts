import { env, Uri } from 'vscode';

export function launchBrowser(uri: string | Uri): Thenable<boolean> {
    return env.openExternal(uri instanceof Uri ? uri : Uri.parse(uri));
}
