import { buildQuoteEmail, emailGreeting } from "../src/lib/quote";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const jenny = buildQuoteEmail({
  customerName: "Jenny Gwynne",
  repairItems: ["Front bumper scratch and scuff"],
  total: 520,
});

const required = [
  "Hi Jenny,",
  "Quote",
  "• Front bumper scratch and scuff",
  "• Estimated total: $520.00",
  "This quote is valid for 30 days from the date of this email.",
  "To ensure the best possible colour match, we use advanced digital colour-matching technology. This allows us to achieve a finish that blends seamlessly with your vehicle’s existing paintwork.",
  "onsite inspection",
  "lifetime workmanship guarantee",
  "preferred repair dates and a mobile number",
  "off-street parking",
  "power point",
  "natural light",
  "Marcel Kuhn",
  "Mobile Car Scratch Repair Adelaide",
];

for (const line of required) {
  assert(jenny.includes(line), `Missing locked line: ${line}`);
}

assert(!jenny.includes("Hi ,"), "Must never emit a bare Hi ,");
assert(!jenny.includes("surrounding paintwork"), "Old short colour-match line must be gone");
assert(emailGreeting("") === "Hi there,", "Empty name must greet Hi there,");
assert(emailGreeting("   ") === "Hi there,", "Whitespace name must greet Hi there,");
assert(emailGreeting("Nathan Crowe") === "Hi Nathan,", "Nathan must greet Hi Nathan,");
assert(
  emailGreeting("Mobile Car Scratch Repair Adelaide") === "Hi there,",
  "Business name must not greet Hi Mobile",
);
assert(emailGreeting("Info") === "Hi there,", "Info must not greet Hi Info");
assert(
  emailGreeting("no-reply") === "Hi there,",
  "no-reply must not be used as a first name",
);

const unnamed = buildQuoteEmail({
  customerName: "",
  repairItems: ["Door scratch"],
  total: 260,
});
assert(unnamed.startsWith("Hi there,"), "Unnamed quote must not start with Hi ,");
assert(!unnamed.includes("Hi ,"), "Unnamed quote must never include Hi ,");

console.log(
  JSON.stringify(
    {
      ok: true,
      greeting: emailGreeting("Jenny Gwynne"),
      includesValidity: jenny.includes(
        "This quote is valid for 30 days from the date of this email.",
      ),
    },
    null,
    2,
  ),
);
