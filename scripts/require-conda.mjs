import process from "node:process";
import path from "node:path";

const expectedEnvironment = "worthit";
const activeEnvironment = process.env.CONDA_DEFAULT_ENV;
const environmentPrefix = process.env.CONDA_PREFIX;
const usesEnvironmentNode = environmentPrefix && process.execPath.startsWith(`${environmentPrefix}${path.sep}`);
const isVercelBuild = process.env.VERCEL === "1";

if (!isVercelBuild && (activeEnvironment !== expectedEnvironment || !usesEnvironmentNode)) {
  console.error(`\nWorthIt must run inside the '${expectedEnvironment}' Conda environment.`);
  console.error(`Run: conda activate ${expectedEnvironment}\n`);
  console.error(`Current Node: ${process.execPath}\n`);
  process.exit(1);
}
