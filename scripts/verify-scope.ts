import {
  buildPhotoAskEmail,
  buildScopeDeclineEmail,
} from "../src/lib/automation-copy";
import { detectOutOfScope } from "../src/lib/scope";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  detectOutOfScope({ damageNotes: "Scratches on bonnet, ceramic coating" }),
  "Bonnet must be out of scope",
);
assert(
  detectOutOfScope({ vehicle: "Roof hail dents" }),
  "Roof must be out of scope",
);
assert(
  !detectOutOfScope({ damageNotes: "Tailgate spoiler scratch" }),
  "Tailgate spoiler is in scope — not the roof",
);
assert(
  !detectOutOfScope({ repairItems: ["Driver door scratch"] }),
  "Door is in scope",
);
assert(
  !detectOutOfScope({ vehicle: "Ford Ranger — bumper" }),
  "Bumper is in scope",
);

const ask = buildPhotoAskEmail({
  customerName: "Jamie Collis",
  suburb: "Paradise",
  service: "panel repair",
  notes: "ceramic coating has been applied",
});
assert(ask.startsWith("Hi Jamie,"), "Photo ask uses first name");
assert(!ask.includes("Hi ,"), "Photo ask must never emit Hi ,");
assert(ask.includes("Paradise"), "Photo ask mentions suburb");
assert(ask.includes("ceramic coating"), "Photo ask mentions coating when present");
assert(ask.includes("0435 222 221"), "Photo ask signs off with owner mobile");
assert(!/estimated total|\$\d/i.test(ask), "Photo ask must not invent a price");

const decline = buildScopeDeclineEmail("Jamie Collis");
assert(decline.startsWith("Hi Jamie,"), "Decline uses first name");
assert(
  decline.includes(
    "the only panels we are unable to repair are the horizontal ones — the bonnet and the roof",
  ),
  "Decline uses Marcel's professional wording",
);
assert(decline.includes("tailgate"), "Decline offers help on other panels");
assert(decline.includes("0435 222 221"), "Decline signs off with owner mobile");

console.log(JSON.stringify({ ok: true }, null, 2));
