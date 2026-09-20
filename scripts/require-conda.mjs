import process from "node:process";
import path from "node:path";

const expectedEnvironment = "worthit";
const activeEnvironment = process.env.CONDA_DEFAULT_ENV;
const environmentPrefix = process.env.CONDA_PREFIX;
const usesEnvironmentNode = environmentPrefix && process.execPath.startsWith(`${environmentPrefix}${path.sep}`);

if (activeEnvironment !== expectedEnvironment || !usesEnvironmentNode) {
  console.error(`\nWotrhit must run inside the '${expectedEnvironment}' Conda environment.`);
  console.error(`Run: conda activate ${expectedEnvironment}\n`);
  console.error(`Current Node: ${process.execPath}\n`);
  process.exit(1);
}
