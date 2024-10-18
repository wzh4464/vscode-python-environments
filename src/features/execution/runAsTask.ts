import { ShellExecution, Task, TaskExecution, TaskPanelKind, TaskRevealKind, TaskScope, WorkspaceFolder } from 'vscode';
import { PythonTaskExecutionOptions } from '../../internal.api';
import { getWorkspaceFolder } from '../../common/workspace.apis';
import { PythonEnvironment } from '../../api';
import { executeTask } from '../../common/tasks.apis';

export async function runAsTask(
    options: PythonTaskExecutionOptions,
    environment: PythonEnvironment,
    extra?: { reveal?: TaskRevealKind },
): Promise<TaskExecution> {
    const workspace: WorkspaceFolder | TaskScope = getWorkspaceFolder(options.project.uri) ?? TaskScope.Global;

    const executable =
        environment.execInfo?.activatedRun?.executable ?? environment.execInfo?.run.executable ?? 'python';
    const args = environment.execInfo?.activatedRun?.args ?? environment.execInfo?.run.args ?? [];
    const allArgs = [...args, ...options.args];

    const task = new Task(
        { type: 'python' },
        workspace,
        options.name,
        'Python',
        new ShellExecution(executable, allArgs, { cwd: options.cwd, env: options.env }),
        '$python',
    );

    task.presentationOptions = {
        reveal: extra?.reveal ?? TaskRevealKind.Silent,
        echo: true,
        panel: TaskPanelKind.Shared,
        close: false,
        showReuseMessage: false,
    };

    const execution = await executeTask(task);
    return execution;
}
