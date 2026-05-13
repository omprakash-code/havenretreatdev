import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

const outDir = "/tmp/havenretreat-prisma-seed";

rmSync(outDir, { recursive: true, force: true });

execFileSync(
  "npx",
  ["tsc", "-p", "prisma/tsconfig.seed.json", "--outDir", outDir],
  { stdio: "inherit" }
);

execFileSync("node", [`${outDir}/seed.js`], { stdio: "inherit" });
