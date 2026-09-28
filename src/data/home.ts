export const principles = [
  { n: "01", t: "Listen first", d: "Most projects start with a problem that isn’t quite the one on the brief. I spend the early time asking questions." },
  { n: "02", t: "Work directly", d: "No account managers or handoffs. You talk to the person doing the work, every time." },
  { n: "03", t: "Build to last", d: "Clean code, sensible tools, and documentation your team can use long after launch." },
  { n: "04", t: "Say it plainly", d: "If something isn’t worth doing, I’ll tell you, and we’ll find what is." },
];

export const services = [
  {
    n: "01",
    href: "/creative-production",
    kicker: "Agencies + marketing teams",
    t: "Creative production",
    d: "Agencies call me when they need extra development firepower or something their in-house team can’t handle. Marketing teams bring me in to turn campaign ideas into digital work that ships quickly and stays on brand.",
    a: "For getting your ambitious projects over the line.",
  },
  {
    n: "02",
    href: "/cms-integrations",
    kicker: "Non-profits + large orgs",
    t: "CMS & integrations",
    d: "I manage large CMS projects, content migrations, and backend integrations for non-profits and other large organizations, connecting content and systems without disrupting the people who depend on them.",
    a: "For when nobody remembers why it works that way.",
  },
  {
    n: "03",
    href: "/tools-for-better-work",
    kicker: "Internal teams",
    t: "Tools for better work",
    d: "I build internal tools that give teams better access to their data and knowledge, automate repetitive work, and monitor the processes they depend on.",
    a: "For the spreadsheet everyone’s afraid to touch.",
  },
];

export type Testimonial = { q: string; name: string; role: string; initials: string };

export const testimonials = {
  tony: {
    q: "Joe is one of the few software developers I’ve met who is also a very capable designer. This blend of skills enabled him to tackle a wide range of issues across a variety of projects. Joe led the development of a consumer facing geolocation app used by Fortune 50 companies and worked on diverse variety of projects such as adding methods to our API, designing custom graphics for the editorial team, and creating prototypes for new mobile applications. Joe’s technical prowess combined with his solid communication skills made him an indispensable member of my team.",
    name: "Tony Ash",
    role: "Chief Technical Officer",
    initials: "TA",
  },
  kathleen: {
    q: "Joe is an extremely skilled web designer, developer and digital problem solver. For many of our online projects, he’s been an instrumental part of our process including planning, assessing and developing. Joe’s also responsive, diligent, detailed and is a strong communicator. He brings creativity, logic and integrity to each of his efforts and we appreciate and strongly recommend his talents.",
    name: "Kathleen Orazio",
    role: "Senior Project Director",
    initials: "KO",
  },
  tom: {
    q: "Working with Okay Plus has been a pleasure and the results are fantastic. Joe created our website 10 years ago, and when it came time to update it, he was who we turned to. He listened to what we wanted and worked with us to refine the design. In the end he was able to produce a custom designed website that looks great and is easy to manage.",
    name: "Tom Bachman, AIA",
    role: "Principal Architect",
    initials: "TB",
  },
  jeremy: {
    q: "Joe has a rare combination of being great at both design and development. He designed and developed, in a short amount of time, a geolocation search application that could be customized by third parties in a framework he had little previous experience in. 5/5 — Would work with again",
    name: "Jeremy Aldrich",
    role: "Senior Software Developer",
    initials: "JA",
  },
} satisfies Record<string, Testimonial>;
