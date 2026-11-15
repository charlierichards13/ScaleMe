// Fictional people/jobs only. Imported by tests, never by the production workspace.
import type { ContextDraft } from "./session";
export const profiles: Array<{ name: string; draft: ContextDraft; answers: string[] }> = [
  { name: "software", draft: {
    resume: "Alex Example built a React portal and wrote REST endpoints for a campus club.",
    title: "Software engineering intern", job: "Develop APIs, test web applications and document design decisions.",
    requirements: "Develop APIs\nTest web applications\nDocument design decisions",
  }, answers: ["I helped test the club portal.", "I wrote an endpoint test for an invalid club identifier; results were not measured.", "I recorded the portal design in the club wiki.", "I asked another club member to follow the wiki; no usage numbers were collected.", "I would explain the invalid identifier case more clearly."] },
  { name: "design", draft: {
    resume: "Blair Example designed a library booking prototype in Figma and sketched a checkout flow.",
    title: "Product design intern", job: "Create prototypes, run usability sessions and explain accessibility choices.",
    requirements: "Create prototypes\nRun usability sessions\nExplain accessibility choices",
  }, answers: ["I showed the booking prototype to a classmate.", "I watched the classmate find the booking button; we did not measure completion time.", "I selected readable labels for the checkout flow.", "I checked the labels with the classmate, but contrast was not measured.", "I would describe which booking step confused the classmate."] },
  { name: "operations", draft: {
    resume: "Casey Example organized a fictional food pantry rota and maintained a stock spreadsheet.",
    title: "Operations coordinator", job: "Maintain inventory, resolve scheduling conflicts and document operating procedures.",
    requirements: "Maintain inventory\nResolve scheduling conflicts\nDocument operating procedures",
  }, answers: ["I helped arrange the pantry rota.", "I asked volunteers about a shift overlap and moved a delivery; no time saving was measured.", "I wrote stock-count instructions in the spreadsheet.", "A volunteer followed those instructions; error counts were not collected.", "I would explain how I handled the overlap in more detail."] },
];
