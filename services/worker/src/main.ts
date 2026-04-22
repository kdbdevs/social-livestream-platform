import { reconcileDisconnectedRooms } from "./jobs/reconcile-rooms.job.js";

async function tick(): Promise<void> {
  const count = await reconcileDisconnectedRooms();

  if (count > 0) {
    console.log(`[worker] reconciled ${count} disconnected live room(s)`);
  }
}

async function main(): Promise<void> {
  await tick();
  setInterval(() => {
    void tick();
  }, 10_000);
}

main().catch((error) => {
  console.error("[worker] fatal", error);
  process.exit(1);
});
