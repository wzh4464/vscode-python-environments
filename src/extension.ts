import { commands, ExtensionContext, LogOutputChannel, Terminal, Uri } from 'vscode';

import { PythonEnvironmentManagers } from './features/envManagers';
import { registerLogger, traceInfo } from './common/logging';
import { EnvManagerView } from './features/views/envManagersView';
import {
    addPythonProject,
    createEnvironmentCommand,
    createTerminalCommand,
    getPackageCommandOptions,
    refreshManagerCommand,
    removeEnvironmentCommand,
    removePythonProject,
    runAsTaskCommand,
    runInTerminalCommand,
    setEnvManagerCommand,
    setEnvironmentCommand,
    setPackageManagerCommand,
    resetEnvironmentCommand,
    refreshPackagesCommand,
    createAnyEnvironmentCommand,
    runInDedicatedTerminalCommand,
    handlePackageUninstall,
    copyPathToClipboard,
} from './features/envCommands';
import { registerCondaFeatures } from './managers/conda/main';
import { registerSystemPythonFeatures } from './managers/builtin/main';
import { PythonProjectManagerImpl } from './features/projectManager';
import { EnvironmentManagers, ProjectCreators, PythonProjectManager } from './internal.api';
import { getPythonApi, setPythonApi } from './features/pythonApi';
import { setPersistentState } from './common/persistentState';
import { createNativePythonFinder, NativePythonFinder } from './managers/common/nativePythonFinder';
import { PythonEnvironment, PythonEnvironmentApi } from './api';
import { ProjectCreatorsImpl } from './features/creators/projectCreators';
import { ProjectView } from './features/views/projectView';
import { registerCompletionProvider } from './features/settings/settingCompletions';
import { TerminalManager, TerminalManagerImpl } from './features/terminal/terminalManager';
import {
    activeTerminal,
    createLogOutputChannel,
    onDidChangeActiveTerminal,
    onDidChangeActiveTextEditor,
    onDidChangeTerminalShellIntegration,
} from './common/window.apis';
import { setActivateMenuButtonContext } from './features/terminal/activateMenuButton';
import { PythonStatusBarImpl } from './features/views/pythonStatusBar';
import { updateViewsAndStatus } from './features/views/revealHandler';
import { EnvVarManager, PythonEnvVariableManager } from './features/execution/envVariableManager';
import { StopWatch } from './common/stopWatch';
import { sendTelemetryEvent } from './common/telemetry/sender';
import { EventNames } from './common/telemetry/constants';
import { ensureCorrectVersion } from './common/extVersion';
import { ExistingProjects } from './features/creators/existingProjects';
import { AutoFindProjects } from './features/creators/autoFindProjects';
import { registerTools } from './common/lm.apis';
import { GetEnvironmentInfoTool, InstallPackageTool } from './features/copilotTools';
import { TerminalActivationImpl } from './features/terminal/terminalActivationState';
import { getEnvironmentForTerminal } from './features/terminal/utils';

export async function activate(context: ExtensionContext): Promise<PythonEnvironmentApi> {
    const start = new StopWatch();

    // Logging should be set up before anything else.
    const outputChannel: LogOutputChannel = createLogOutputChannel('Python Environments');
    context.subscriptions.push(outputChannel, registerLogger(outputChannel));

    ensureCorrectVersion();

    // Setup the persistent state for the extension.
    setPersistentState(context);

    const statusBar = new PythonStatusBarImpl();
    context.subscriptions.push(statusBar);

    const projectManager: PythonProjectManager = new PythonProjectManagerImpl();
    context.subscriptions.push(projectManager);

    const envVarManager: EnvVarManager = new PythonEnvVariableManager(projectManager);
    context.subscriptions.push(envVarManager);

    const envManagers: EnvironmentManagers = new PythonEnvironmentManagers(projectManager);
    context.subscriptions.push(envManagers);

    const terminalActivation = new TerminalActivationImpl();
    const terminalManager: TerminalManager = new TerminalManagerImpl(terminalActivation);
    context.subscriptions.push(terminalActivation, terminalManager);

    const projectCreators: ProjectCreators = new ProjectCreatorsImpl();
    context.subscriptions.push(
        projectCreators,
        projectCreators.registerPythonProjectCreator(new ExistingProjects()),
        projectCreators.registerPythonProjectCreator(new AutoFindProjects(projectManager)),
    );

    setPythonApi(envManagers, projectManager, projectCreators, terminalManager, envVarManager);

    const managerView = new EnvManagerView(envManagers);
    context.subscriptions.push(managerView);

    const workspaceView = new ProjectView(envManagers, projectManager);
    context.subscriptions.push(workspaceView);

    workspaceView.initialize();
    const api = await getPythonApi();

    const monitoredTerminals = new Map<Terminal, PythonEnvironment>();

    context.subscriptions.push(
        registerCompletionProvider(envManagers),
        registerTools('python_environment_tool', new GetEnvironmentInfoTool(api, envManagers)),
        registerTools('python_install_package_tool', new InstallPackageTool(api)),
        commands.registerCommand('python-envs.viewLogs', () => outputChannel.show()),
        commands.registerCommand('python-envs.refreshManager', async (item) => {
            await refreshManagerCommand(item);
        }),
        commands.registerCommand('python-envs.refreshAllManagers', async () => {
            await Promise.all(envManagers.managers.map((m) => m.refresh(undefined)));
        }),
        commands.registerCommand('python-envs.refreshPackages', async (item) => {
            await refreshPackagesCommand(item);
        }),
        commands.registerCommand('python-envs.create', async (item) => {
            return await createEnvironmentCommand(item, envManagers, projectManager);
        }),
        commands.registerCommand('python-envs.createAny', async (options) => {
            return await createAnyEnvironmentCommand(
                envManagers,
                projectManager,
                options ?? { selectEnvironment: true },
            );
        }),
        commands.registerCommand('python-envs.remove', async (item) => {
            await removeEnvironmentCommand(item, envManagers);
        }),
        commands.registerCommand('python-envs.packages', async (options: unknown) => {
            const { environment, packageManager } = await getPackageCommandOptions(
                options,
                envManagers,
                projectManager,
            );
            packageManager.manage(environment, { install: [] });
        }),
        commands.registerCommand('python-envs.uninstallPackage', async (context: unknown) => {
            await handlePackageUninstall(context, envManagers);
        }),
        commands.registerCommand('python-envs.set', async (item) => {
            await setEnvironmentCommand(item, envManagers, projectManager);
        }),
        commands.registerCommand('python-envs.setEnv', async (item) => {
            await setEnvironmentCommand(item, envManagers, projectManager);
        }),
        commands.registerCommand('python-envs.reset', async (item) => {
            await resetEnvironmentCommand(item, envManagers, projectManager);
        }),
        commands.registerCommand('python-envs.setEnvManager', async () => {
            await setEnvManagerCommand(envManagers, projectManager);
        }),
        commands.registerCommand('python-envs.setPkgManager', async () => {
            await setPackageManagerCommand(envManagers, projectManager);
        }),
        commands.registerCommand('python-envs.addPythonProject', async (resource) => {
            await addPythonProject(resource, projectManager, envManagers, projectCreators);
        }),
        commands.registerCommand('python-envs.removePythonProject', async (item) => {
            await resetEnvironmentCommand(item, envManagers, projectManager);
            await removePythonProject(item, projectManager);
        }),
        commands.registerCommand('python-envs.clearCache', async () => {
            await envManagers.clearCache(undefined);
        }),
        commands.registerCommand('python-envs.runInTerminal', (item) => {
            return runInTerminalCommand(item, api, terminalManager);
        }),
        commands.registerCommand('python-envs.runInDedicatedTerminal', (item) => {
            return runInDedicatedTerminalCommand(item, api, terminalManager);
        }),
        commands.registerCommand('python-envs.runAsTask', (item) => {
            return runAsTaskCommand(item, api);
        }),
        commands.registerCommand('python-envs.createTerminal', (item) => {
            return createTerminalCommand(item, api, terminalManager);
        }),
        commands.registerCommand('python-envs.copyEnvPath', async (item) => {
            await copyPathToClipboard(item);
        }),
        commands.registerCommand('python-envs.copyProjectPath', async (item) => {
            await copyPathToClipboard(item);
        }),
        commands.registerCommand('python-envs.terminal.activate', async () => {
            const terminal = activeTerminal();
            if (terminal) {
                const env = await getEnvironmentForTerminal(api, terminal);
                if (env) {
                    await terminalManager.activate(terminal, env);
                }
            }
        }),
        commands.registerCommand('python-envs.terminal.deactivate', async () => {
            const terminal = activeTerminal();
            if (terminal) {
                await terminalManager.deactivate(terminal);
            }
        }),
        terminalActivation.onDidChangeTerminalActivationState(async (e) => {
            await setActivateMenuButtonContext(e.terminal, e.environment, e.activated);
        }),
        onDidChangeActiveTerminal(async (t) => {
            if (t) {
                const env = terminalActivation.getEnvironment(t) ?? (await getEnvironmentForTerminal(api, t));
                if (env) {
                    await setActivateMenuButtonContext(t, env, terminalActivation.isActivated(t));
                }
            }
        }),
        onDidChangeActiveTextEditor(async () => {
            updateViewsAndStatus(statusBar, workspaceView, managerView, api);
        }),
        envManagers.onDidChangeEnvironment(async () => {
            updateViewsAndStatus(statusBar, workspaceView, managerView, api);
        }),
        envManagers.onDidChangeEnvironments(async () => {
            updateViewsAndStatus(statusBar, workspaceView, managerView, api);
        }),
        envManagers.onDidChangeEnvironmentFiltered(async (e) => {
            managerView.environmentChanged(e);
            const location = e.uri?.fsPath ?? 'global';
            traceInfo(
                `Internal: Changed environment from ${e.old?.displayName} to ${e.new?.displayName} for: ${location}`,
            );
            updateViewsAndStatus(statusBar, workspaceView, managerView, api);
        }),
        onDidChangeTerminalShellIntegration(async (e) => {
            const shellEnv = e.shellIntegration?.env;
            if (!shellEnv) {
                return;
            }
            const envVar = shellEnv.value;
            if (envVar) {
                if (envVar['VIRTUAL_ENV']) {
                    const env = await api.resolveEnvironment(Uri.file(envVar['VIRTUAL_ENV']));
                    if (env) {
                        monitoredTerminals.set(e.terminal, env);
                        terminalActivation.updateActivationState(e.terminal, env, true);
                    }
                } else if (monitoredTerminals.has(e.terminal)) {
                    const env = monitoredTerminals.get(e.terminal);
                    if (env) {
                        terminalActivation.updateActivationState(e.terminal, env, false);
                    }
                }
            }
        }),
    );

    /**
     * Below are all the contributed features using the APIs.
     */
    setImmediate(async () => {
        // This is the finder that is used by all the built in environment managers
        const nativeFinder: NativePythonFinder = await createNativePythonFinder(outputChannel, api, context);
        context.subscriptions.push(nativeFinder);
        await Promise.all([
            registerSystemPythonFeatures(nativeFinder, context.subscriptions, outputChannel),
            registerCondaFeatures(nativeFinder, context.subscriptions, outputChannel),
        ]);
        sendTelemetryEvent(EventNames.EXTENSION_MANAGER_REGISTRATION_DURATION, start.elapsedTime);
        await terminalManager.initialize(api);
    });

    sendTelemetryEvent(EventNames.EXTENSION_ACTIVATION_DURATION, start.elapsedTime);

    return api;
}

export function deactivate() {}
