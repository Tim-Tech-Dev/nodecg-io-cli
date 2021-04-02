import { CommandModule } from "yargs";
import * as path from "path";
import { directoryExists, findNodeCGDirectory, getNodeCGIODirectory } from "../fsUtils";
import { createDevInstall } from "./development";
import { manageBundleDir } from "../nodecgConfig";
import { promptForInstallInfo } from "./prompt";
import { isInstallInfoEquals, readInstallInfo, writeInstallInfo } from "../installation";
import { createProductionInstall } from "./production";
import * as fs from "fs/promises";

export const installModule: CommandModule = {
    command: "install",
    describe: "installs nodecg-io",
    handler: async () => {
        try {
            await install();
        } catch (err) {
            console.log();
            console.error(`Error while installing nodecg-io: ${err}`);
            process.exit(1);
        }
    },
};

async function install(): Promise<void> {
    console.log("Installing nodecg-io...");

    const nodecgDir = await findNodeCGDirectory();
    if (!nodecgDir) {
        throw "Couldn't find a nodecg installation. Make sure that you are in the directory of you nodecg installation.";
    }

    console.log(`Detected nodecg installation at ${nodecgDir}.`);
    const nodecgIODir = getNodeCGIODirectory(nodecgDir);

    const currentInstall = await readInstallInfo(nodecgIODir);
    const requestedInstall = await promptForInstallInfo(currentInstall);

    // TODO: can be removed once we have incremental installing in dev and prod.
    if (isInstallInfoEquals(currentInstall, requestedInstall)) {
        console.log("Requested installation is already installed. Not installing.");
        return;
    }

    // If the minor version changed and we already have another one installed, we need to delete it, so it can be properly installed.
    if (currentInstall && currentInstall.version !== requestedInstall.version && (await directoryExists(nodecgIODir))) {
        console.log(`Deleting nodecg-io version "${currentInstall.version}"...`);
        await fs.rm(nodecgIODir, { recursive: true, force: true });
    }

    console.log(`Installing nodecg-io version "${requestedInstall.version}"...`);

    // Get packages
    if (requestedInstall.dev) {
        await createDevInstall(requestedInstall, nodecgIODir);
    } else {
        await createProductionInstall(
            requestedInstall,
            currentInstall && !currentInstall.dev ? currentInstall : undefined,
            nodecgIODir,
        );
    }

    // Add bundle dirs to the nodecg config, so that they are loaded.
    await manageBundleDir(nodecgDir, nodecgIODir, true);
    await manageBundleDir(
        nodecgDir,
        path.join(nodecgIODir, "samples"),
        requestedInstall.dev && requestedInstall.useSamples,
    );

    await writeInstallInfo(nodecgIODir, requestedInstall);
}
