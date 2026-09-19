import { runAutomations } from "../src/lib/automations";
import { prisma } from "../src/lib/prisma";

async function main() {
  if (process.env.DEMO_MODE === "false") {
    throw new Error("Refusing to run demo verification while DEMO_MODE=false.");
  }

  const result = await runAutomations();
  if (result.emailed) {
    throw new Error("Demo run emailed someone — automations must not send.");
  }
  if (!result.demo) {
    throw new Error("Expected demo mode to be on.");
  }

  const delivered = await prisma.automationEvent.count({
    where: { delivered: true },
  });
  if (delivered > 0) {
    throw new Error(
      `Found ${delivered} delivered automation event(s). Demo must stay undelivered.`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        emailed: result.emailed,
        demo: result.demo,
        queued: result.queued,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
