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

export const impactProfiles = [
  { name: "portal", draft: { resume: "Built web applications for a campus library booking desk.", title: "Web developer", job: "Build web applications. Test web applications. Automate reports.", requirements: "Build web applications\nTest web applications\nAutomate reports" }, answer: "I tested web applications with invalid bookings and mobile navigation before rollout." },
  { name: "design research", draft: { resume: "Designed prototypes for a fictional museum ticket kiosk.", title: "Designer", job: "Design prototypes. Test prototypes. Automate reports.", requirements: "Design prototypes\nTest prototypes\nAutomate reports" }, answer: "I tested prototypes with museum volunteers using printed tickets and checkout tasks." },
  { name: "inventory operations", draft: { resume: "Managed inventory for a fictional community pantry delivery team.", title: "Operations analyst", job: "Manage inventory. Validate inventory. Automate reports.", requirements: "Manage inventory\nValidate inventory\nAutomate reports" }, answer: "I validated inventory against delivery records by checking missing items and duplicate entries." },
];
