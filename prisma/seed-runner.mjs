import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), ".prisma-seed");

rmSync(outDir, { recursive: true, force: true });

execFileSync(
  "npx",
  ["tsc", "-p", "prisma/tsconfig.seed.json", "--outDir", outDir],
  { stdio: "inherit" }
);

execFileSync("node", [join(outDir, "seed.js")], { stdio: "inherit" });
