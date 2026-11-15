// Standalone UI fixture. These are fabricated examples, NOT real opportunities.
// Do not imply any of the entries can be applied to or have been sourced from an API.

export type DemoOpening = {
  id: string;
  title: string;
  company: string;
  location: string;
  arrangement: "On-site" | "Hybrid" | "Remote";
  type: "Internship" | "Entry-level";
  focus: string;
  description: string;
  skills: string[];
  whyShown: string;
};

export const DEMO_OPENINGS: readonly DemoOpening[] = [
  {
    id: "demo-swe-01",
    title: "Software Engineering Intern",
    company: "Fictional Company A",
    location: "Phoenix, AZ",
    arrangement: "Hybrid",
    type: "Internship",
    focus: "Web platforms",
    description: "Build internal tools, collaborate with engineers, and learn modern full-stack practices in a fictional internship.",
    skills: ["React", "TypeScript", "REST APIs"],
    whyShown: "Illustrates a web-development internship for users interested in building applications. This is not based on your resume.",
  },
  {
    id: "demo-cyber-02",
    title: "Cybersecurity Engineering Intern",
    company: "Fictional Company B",
    location: "Tempe, AZ",
    arrangement: "On-site",
    type: "Internship",
    focus: "App security",
    description: "Practice security testing, investigate vulnerabilities, and work with a fictional application-security team.",
    skills: ["Python", "Security testing", "Linux"],
    whyShown: "Illustrates a security-focused internship for candidates interested in secure software development.",
  },
  {
    id: "demo-cloud-03",
    title: "Cloud Developer Intern",
    company: "Fictional Company C",
    location: "Remote",
    arrangement: "Remote",
    type: "Internship",
    focus: "Cloud services",
    description: "Experiment with cloud functions, APIs, and deployment workflows in a fictional cloud engineering internship.",
    skills: ["AWS", "APIs", "Git"],
    whyShown: "Illustrates a cloud-oriented role rather than making an unsupported claim about candidate qualifications.",
  },
  {
    id: "demo-systems-04",
    title: "Junior Systems Developer",
    company: "Fictional Company D",
    location: "Chandler, AZ",
    arrangement: "Hybrid",
    type: "Entry-level",
    focus: "Enterprise systems",
    description: "Develop and maintain internal software, integrations, and technical workflows at a fictional company.",
    skills: ["TypeScript", "SQL", "Automation"],
    whyShown: "Illustrates an early-career enterprise development opportunity.",
  },
  {
    id: "demo-data-05",
    title: "Machine Learning Intern",
    company: "Fictional Company E",
    location: "Seattle, WA",
    arrangement: "On-site",
    type: "Internship",
    focus: "ML engineering",
    description: "Build and evaluate basic machine-learning experiments for a fictional product team.",
    skills: ["Python", "Evaluation", "Data analysis"],
    whyShown: "Illustrates a machine-learning internship; no personalized ranking has been computed.",
  },
  {
    id: "demo-product-06",
    title: "Frontend Engineering Intern",
    company: "Fictional Company F",
    location: "Remote",
    arrangement: "Remote",
    type: "Internship",
    focus: "Accessible UI",
    description: "Improve usability, responsive layouts, and frontend quality in a fictional product internship.",
    skills: ["React", "CSS", "Accessibility"],
    whyShown: "Illustrates a frontend-focused opportunity and lets users test the save/pass controls.",
  },
];
