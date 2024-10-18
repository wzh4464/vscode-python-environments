import { Disposable, StatusBarAlignment, StatusBarItem, ThemeColor, Uri } from 'vscode';
import { createStatusBarItem } from '../common/window.apis';
import { Interpreter } from '../common/localize';
import { PythonProjectManager } from '../internal.api';
import { PythonEnvironment } from '../api';

const STATUS_BAR_ITEM_PRIORITY = 100.09999;

export interface PythonStatusBar extends Disposable {
    update(uri: Uri | undefined, env?: PythonEnvironment): void;
    show(uri: Uri): void;
    hide(): void;
}

export class PythonStatusBarImpl implements PythonStatusBar {
    private _global: PythonEnvironment | undefined;
    private _statusBarItem: StatusBarItem;
    private _disposables: Disposable[] = [];
    private _uriToEnv: Map<string, PythonEnvironment> = new Map();
    constructor(private readonly projectManager: PythonProjectManager) {
        this._statusBarItem = createStatusBarItem(
            'python-envs.statusBarItem.selectedInterpreter',
            StatusBarAlignment.Right,
            STATUS_BAR_ITEM_PRIORITY,
        );
        this._statusBarItem.command = 'python-envs.set';
        this._disposables.push(this._statusBarItem);
    }

    public update(uri: Uri | undefined, env?: PythonEnvironment): void {
        const project = uri ? this.projectManager.get(uri)?.uri : undefined;
        if (!project) {
            this._global = env;
        } else {
            if (env) {
                this._uriToEnv.set(project.toString(), env);
            } else {
                this._uriToEnv.delete(project.toString());
            }
        }
    }
    public show(uri: Uri | undefined) {
        const project = uri ? this.projectManager.get(uri)?.uri : undefined;
        const environment = project ? this._uriToEnv.get(project.toString()) : this._global;
        if (environment) {
            this._statusBarItem.text = environment.shortDisplayName ?? environment.displayName;
            this._statusBarItem.tooltip = environment.environmentPath.fsPath;
            this._statusBarItem.backgroundColor = undefined;
            this._statusBarItem.show();
            return;
        } else if (project) {
            // Show alert only if it is a project file
            this._statusBarItem.tooltip = '';
            this._statusBarItem.backgroundColor = new ThemeColor('statusBarItem.warningBackground');
            this._statusBarItem.text = `$(alert) ${Interpreter.statusBarSelect}`;
            this._statusBarItem.show();
            return;
        }

        this._statusBarItem.hide();
    }

    public hide() {
        this._statusBarItem.hide();
    }

    dispose() {
        this._disposables.forEach((d) => d.dispose());
    }
}
