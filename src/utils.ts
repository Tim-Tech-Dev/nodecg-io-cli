import * as fs from "fs/promises";
import * as path from "path";
import * as findUp from "find-up";
import { spawn } from "child_process";

export const corePackage = "nodecg-io-core";
export const dashboardPackage = "nodecg-io-dashboard";
export const developmentVersion = "development";

/**
 * Traverses the filesystem and uses {@link isNodeCGDirectory} to find a local nodecg installation.
 */
export async function findNodeCGDirectory(): Promise<string | undefined> {
    return await findUp(async (dir) => ((await isNodeCGDirectory(dir)) ? dir : undefined), { type: "directory" });
}

/**
 * Builds the path where the nodecg-io directory should be located. It is not checked whether it exists or not!
 */
export function getNodeCGIODirectory(nodecgDir: string): string {
    return path.join(nodecgDir, "nodecg-io");
}

/**
 * Checks whether a nodecg installation is in the passed directory.
 * It currently does this by checking for a package.json which must contain the name "nodecg"
 * @param dir the directory which may contain the nodecg installation
 */
async function isNodeCGDirectory(dir: string): Promise<boolean> {
    const packageJsonPath = path.join(dir, "package.json");

    try {
        await fs.access(packageJsonPath); // no exception => accessable
    } catch (err) {
        return false; // User can't access this file/directory
    }

    const data = await fs.readFile(packageJsonPath);
    const json = JSON.parse(data.toString());
    const packageName = json["name"];
    return packageName === "nodecg";
}

// TODO: maybe use execa
// TODO: show in which directory the command is executed.

/**
 * Executes the given command and optinally streams the output to the console.
 * @param command the command that should be executed.
 * @param args the args which will be passed to the command
 * @param streamOutput whether the output (stdout and stderr) should be streamed to the ones of the current process.
 *                     if there was an error stderr will always be written to the stderr of this process after the command has finished and failed.
 * @param workingDir in which directory the command should be executed
 * @return a promise which will be resolved if the command exited with a non-zero exit code and rejected otherwise.
 */
export async function executeCommand(
    command: string,
    args: string[],
    streamOutput: boolean,
    workingDir?: string,
): Promise<void> {
    if (streamOutput) console.log(`>>> ${command} ${args.join(" ")}`);

    const child = spawn(command, args, { cwd: workingDir });

    if (streamOutput) {
        // Streams output to stdout/stderr of this process.
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
    }

    return new Promise((resolve, reject) => {
        child.addListener("error", (err) => reject(err));

        child.addListener("exit", (code) => {
            if (streamOutput) console.log();

            if (code === 0) {
                resolve();
            } else {
                // There was an error so we should present hte user with the error message even if the output of this command
                // should not be streamed normally, because hte user needs it to be able to debug the problem.
                if (!streamOutput) {
                    child.stderr.pipe(process.stderr);
                }
                reject(`Command "${command} ${args.join(" ")}" returned error code ${code}!`);
            }
        });
    });
}
