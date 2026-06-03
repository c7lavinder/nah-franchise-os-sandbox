import { runRunwayPipelineGuardian } from "@/lib/agents/runway-pipeline-guardian";

const repair = process.argv.includes("--repair");

runRunwayPipelineGuardian({ repair })
  .then((result) => {
    console.log(
      JSON.stringify(
        {
          success: result.success,
          repaired: result.repaired,
          repairErrors: result.repairResult?.errors ?? [],
          activeRunwayRows: result.audit.activeRunwayRows,
          expectedRunwayRows: result.audit.expectedRunwayRows,
          runningRows: result.audit.runningRows,
          inventoryBuildingRows: result.audit.inventoryBuildingRows,
          firstPurchaseRows: result.audit.firstPurchaseRows,
          issues: result.audit.issues,
        },
        null,
        2
      )
    );
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
