import { runAutomations } from "../src/lib/automations";

async function main() {
  const result = await runAutomations();
  console.log(JSON.stringify(result, null, 2));
  if (result.demo) {
    console.log(
      "Demo mode: nothing was emailed. Due messages were queued on each job.",
    );
  } else if (!result.emailed && result.queued.length > 0) {
    console.log(
      "Jobs were due, but Gmail did not send. Connect Google or check tokens.",
    );
  } else if (result.queued.length === 0) {
    console.log("No follow-ups or review asks were due.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
