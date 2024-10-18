import { extensions } from 'vscode';
import { ENVS_EXTENSION_ID, PYTHON_EXTENSION_ID } from './constants';
import { parseStack } from './errors/utils';

export function getCallingExtension(): string {
    const frames = parseStack(new Error());

    const pythonExts = [ENVS_EXTENSION_ID, PYTHON_EXTENSION_ID];
    const otherExts = extensions.all.map((ext) => ext.id).filter((id) => !pythonExts.includes(id));

    for (const frame of frames) {
        for (const ext of otherExts) {
            const filename = frame.getFileName();
            if (filename) {
                const parts = filename.split(/\\\//);
                if (parts.includes(ext)) {
                    return ext;
                }
            }
        }
    }

    return PYTHON_EXTENSION_ID;
}
