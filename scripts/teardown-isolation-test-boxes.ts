/**
 * Borra permanentemente Test Box A / Test Box B (creados por check-box-isolation en CI).
 *
 *   ATHRON_QA_CONFIRM=true npm run teardown-isolation-boxes
 */

import { teardownIsolationTestBoxes } from "./lib/teardown-isolation-test-boxes";
import { requireQaScriptEnv } from "./lib/qa-demo-boxes-env";

async function main() {
  const { service } = requireQaScriptEnv();

  console.log("🧹 Teardown Test Box A / Test Box B\n");

  const result = await teardownIsolationTestBoxes(service);

  console.log("\n══════════════════════════════════════════");
  if (result.removedBoxes.length === 0) {
    console.log("No se encontraron test-box-a ni test-box-b.");
  } else {
    console.log(`Boxes eliminados: ${result.removedBoxes.join(", ")}`);
    console.log(
      `Usuarios auth: ${result.deletedUsers} · perfiles: ${result.deletedProfiles}`
    );
  }
  console.log("══════════════════════════════════════════\n");
  console.log(
    "Nota: el CI ya no recreará estos boxes en producción (ver .github/workflows/ci.yml).\n"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
