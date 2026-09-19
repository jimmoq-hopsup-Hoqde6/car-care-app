import {
  buildPhotoAskEmail,
  buildScopeDeclineEmail,
  SCOPE_DECLINE_FRAMING,
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
  detectOutOfScope({ vehicle: "Hood scratch" }),
  "Hood (bonnet) must be out of scope",
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
  !detectOutOfScope({ damageNotes: "Scratch on the tailgate" }),
  "Tailgate is in scope",
);
assert(
  !detectOutOfScope({ repairItems: ["Driver door scratch"] }),
  "Door is in scope",
);
assert(
  !detectOutOfScope({ vehicle: "Ford Ranger — bumper" }),
  "Bumper is in scope",
);
assert(
  !detectOutOfScope({ damageNotes: "Front guard / fender scuff" }),
  "Guard/fender is in scope",
);
assert(
  !detectOutOfScope({ repairItems: ["Rear quarter panel scratch"] }),
  "Quarter is in scope",
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
assert(ask.includes("panel/bonnet"), "Photo ask asks for panel/bonnet shots");
assert(ask.includes("ceramic coating"), "Photo ask mentions coating when present");
assert(ask.includes("0435 222 221"), "Photo ask signs off with owner mobile");
assert(!/estimated total|\$\d/i.test(ask), "Photo ask must not invent a price");

const decline = buildScopeDeclineEmail("Jamie Collis");
assert(decline.startsWith("Hi Jamie,"), "Decline uses first name");
assert(!decline.includes("Hi ,"), "Decline must never emit Hi ,");
assert(
  decline.includes(SCOPE_DECLINE_FRAMING),
  "Decline uses Marcel's professional horizontal-panel wording",
);
assert(
  !/i don't do bonnets|i do not do bonnets|can't do bonnets|cannot do bonnets/i.test(
    decline,
  ),
  "Decline must not use blunt 'I don't do bonnets' wording",
);
assert(decline.includes("photos"), "Decline offers help on other panels with photos");
assert(decline.includes("tailgate"), "Decline lists tailgate as an in-scope panel");
assert(decline.includes("Marcel Kuhn"), "Decline signs off with Marcel Kuhn");
assert(
  decline.includes("Mobile Car Scratch Repair Adelaide"),
  "Decline signs off with the business name",
);
assert(decline.includes("0435 222 221"), "Decline signs off with owner mobile");
assert(!/estimated total|\$\d/i.test(decline), "Decline must not invent a price");

console.log(JSON.stringify({ ok: true }, null, 2));
