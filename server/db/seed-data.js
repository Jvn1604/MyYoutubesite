/**
 * Initial website content, migrated from legacy/index.html.
 * Seeded once into the database (npm run db:seed); after that the admin
 * dashboard owns it. Re-running the seed never overwrites admin edits.
 * YouTube data (videos, channel stats) is NOT seeded: it comes from sync.
 */

const SITE_DESCRIPTION = "DePhantom தமிழ் – Tamil gaming livestreams: soulslike, action RPGs and day-one releases with Tamil commentary. Join the Phantom Troupe.";

export const settings = {
  seo: {
    title: "DePhantom தமிழ் | Tamil Gaming Livestreams",
    description: SITE_DESCRIPTION,
    ogImageUrl: "",
    twitterHandle: "",
  },
  schedule: {
    timezone: "Asia/Kuala_Lumpur",
    message: "Live every night. Turn on the 🔔 so YouTube tells you the moment I go live.",
    compareZones: [
      { label: "Malaysia", timeZone: "Asia/Kuala_Lumpur" },
      { label: "India", timeZone: "Asia/Kolkata" },
      { label: "Sri Lanka", timeZone: "Asia/Colombo" },
      { label: "Singapore", timeZone: "Asia/Singapore" },
    ],
  },
  brand: {
    name: "DePhantom",
    nameTa: "தமிழ்",
    greetingTa: "வணக்கம் நண்பர்களே!",
    community: "Phantom Troupe",
    logoUrl: "/fallback/avatar.svg",
  },
  hero: {
    heading: "DePhantom",
    headingTa: "தமிழ்",
    tagline: "Tamil Gaming. Brutal Bosses. Legendary Journeys.",
    lead: "Soulslike, action RPGs and the newest big releases, streamed live with Tamil commentary. Come play, chat and suffer through boss fights with the Phantom Troupe.",
    backgroundUrl: "",
    ctas: [
      { key: "latest", label: "Watch Latest", url: "#latest", style: "primary", enabled: true },
      { key: "live", label: "Watch Live", url: "https://www.youtube.com/@ImDePhantom/live", style: "youtube", enabled: true },
      { key: "subscribe", label: "Subscribe", url: "https://www.youtube.com/@ImDePhantom?sub_confirmation=1", style: "ghost", enabled: true },
      { key: "discord", label: "Join Discord", url: "https://discord.gg/RdwRFEeb8K", style: "ghost", enabled: true },
    ],
  },
  about: {
    title: "Who is DePhantom?",
    paragraphs: [
      "DePhantom is a Tamil gaming streamer who has been live since February 2024. That's hundreds of streams, mostly soulslike and action RPGs, and always the newest big releases, played live with real Tamil commentary.",
      "The channel is for Tamil gamers everywhere: India, Malaysia, Sri Lanka and beyond. Whether you're a soulslike veteran or just getting started, you're welcome in the Phantom Troupe.",
    ],
    features: ["Daily live streams", "Tamil commentary", "Full walkthroughs", "No-damage boss runs", "Reviews, tips & lore", "Community events"],
    channelStart: "2024-02-27",
    genres: ["Soulslike", "Action RPG", "Story adventures", "Co-op chaos"],
    milestones: [
      { date: "2024-02-27", title: "Channel launched" },
      { date: "2024-08", title: "Black Myth: Wukong stream passes 77K views" },
      { date: "2026-10", title: "1,350 subscribers and 490+ livestreams" },
    ],
    photoUrl: "",
  },
  support: {
    title: "Support the Phantom Troupe",
    text: "The streams run on community support. Memberships and Super Chats keep the games coming. Thank you to every member! 💜",
    methods: [
      { key: "membership", label: "Join membership", description: "Monthly YouTube membership with member perks", url: "https://www.youtube.com/@ImDePhantom/join", enabled: true },
      { key: "superchat", label: "Super Chat on stream", description: "Get your message highlighted live", url: "https://www.youtube.com/@ImDePhantom/live", enabled: true },
      { key: "subscribe", label: "Subscribe for free", description: "The easiest way to help the channel grow", url: "https://www.youtube.com/@ImDePhantom?sub_confirmation=1", enabled: true },
    ],
    perks: ["Loyalty badges next to your name in chat", "Custom Tamil emojis", "Vote on the next game", "Shout-outs on stream"],
    perksEnabled: false, // not yet confirmed by the creator
  },
  footer: { text: "Game on! 🎮" },
  links: {
    channel: "https://www.youtube.com/@ImDePhantom",
    subscribe: "https://www.youtube.com/@ImDePhantom?sub_confirmation=1",
    live: "https://www.youtube.com/@ImDePhantom/live",
    streams: "https://www.youtube.com/@ImDePhantom/streams",
    join: "https://www.youtube.com/@ImDePhantom/join",
    discord: "https://discord.gg/RdwRFEeb8K",
  },
  appearance: { primary: "#a855f7", secondary: "#e04bff", background: "#0a0a0f", radiusScale: 1, motion: "normal" },
  sections: ["hero", "stats", "latest", "streams", "worlds", "games", "schedule", "goal", "videos", "community", "support", "about"]
    .map((key) => ({ key, enabled: true })),
};

export const games = [
  { slug: "valor-mortis", name: "Valor Mortis", status: "playing", genre: "Soulslike", releaseYear: 2026, description: "Napoleonic-era soulslike, played blind from day one.", coverUrl: "", playlistUrl: "", featured: true, hidden: false, sortOrder: 1 },
  { slug: "control-resonant", name: "CONTROL Resonant", status: "completed", genre: "Action", releaseYear: 2026, description: "", coverUrl: "", playlistUrl: "", featured: false, hidden: false, sortOrder: 2 },
  { slug: "blood-of-dawnwalker", name: "The Blood of Dawnwalker", status: "completed", genre: "Action RPG", releaseYear: 2026, description: "", coverUrl: "", playlistUrl: "", featured: false, hidden: false, sortOrder: 3 },
  { slug: "onimusha-way-of-the-sword", name: "Onimusha: Way of the Sword", status: "completed", genre: "Action", releaseYear: 2026, description: "No-damage boss runs on the hardest difficulty.", coverUrl: "", playlistUrl: "", featured: false, hidden: false, sortOrder: 4 },
  { slug: "crimson-desert", name: "Crimson Desert", status: "completed", genre: "Action RPG", releaseYear: 2026, description: "", coverUrl: "", playlistUrl: "", featured: false, hidden: false, sortOrder: 5 },
  { slug: "black-myth-wukong", name: "Black Myth: Wukong", status: "favourite", genre: "Action RPG", releaseYear: 2024, description: "The stream that brought 77K viewers to the channel.", coverUrl: "", playlistUrl: "", featured: true, hidden: false, sortOrder: 6 },
  { slug: "elden-ring", name: "Elden Ring", status: "completed", genre: "Soulslike", releaseYear: 2022, description: "", coverUrl: "", playlistUrl: "", featured: false, hidden: false, sortOrder: 7 },
  { slug: "bloodborne", name: "Bloodborne", status: "favourite", genre: "Soulslike", releaseYear: 2015, description: "Complete lore deep-dive in Tamil.", coverUrl: "", playlistUrl: "", featured: false, hidden: false, sortOrder: 8 },
  { slug: "a-plague-tale", name: "A Plague Tale", status: "completed", genre: "Adventure", releaseYear: 2022, description: "", coverUrl: "", playlistUrl: "", featured: false, hidden: false, sortOrder: 9 },
  { slug: "mortal-shell", name: "Mortal Shell", status: "completed", genre: "Soulslike", releaseYear: 2020, description: "", coverUrl: "", playlistUrl: "", featured: false, hidden: false, sortOrder: 10 },
  { slug: "party-animals", name: "Party Animals", status: "playing", genre: "Party", releaseYear: 2023, description: "Chaos with friends.", coverUrl: "", playlistUrl: "", featured: false, hidden: false, sortOrder: 11 },
];

// Daily 21:00 MYT (from the legacy site; confirm in the admin dashboard)
export const scheduleRules = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, time: "21:00", title: "Nightly stream", enabled: true }));

/** Keywords used to auto-assign synced videos to games by title. */
export const gameKeywords = {
  "valor-mortis": ["valor mortis"],
  "control-resonant": ["control resonant"],
  "blood-of-dawnwalker": ["dawnwalker"],
  "onimusha-way-of-the-sword": ["onimusha"],
  "crimson-desert": ["crimson desert"],
  "black-myth-wukong": ["black myth", "wukong"],
  "elden-ring": ["elden ring"],
  bloodborne: ["bloodborne"],
  "a-plague-tale": ["plague tale"],
  "mortal-shell": ["mortal shell"],
  "party-animals": ["party animals"],
};

/** Shape used by the dev fixture + payload builder until phase 9 reads the DB. */
export const schedule = {
  ...settings.schedule,
  rules: scheduleRules,
  events: [],
};

export const goal = {
  title: "Road to 1,652 subscribers",
  description: "The 3-month challenge: +300 new members of the Phantom Troupe.",
  start: 1352,
  target: 1652,
  deadline: "2027-01-16",
  enabled: true,
  celebrate: true,
};

export const socials = [
  { platform: "youtube", label: "YouTube", description: "Streams, videos and Shorts", url: "https://www.youtube.com/@ImDePhantom", accent: "#ff0033", enabled: true, sortOrder: 1 },
  { platform: "discord", label: "Discord", description: "Chat, play together, stream alerts", url: "https://discord.gg/RdwRFEeb8K", accent: "#5865F2", enabled: true, sortOrder: 2 },
  { platform: "whatsapp", label: "WhatsApp Channel", description: "Going-live alerts on your phone", url: "https://whatsapp.com/channel/0029VbEPJeHBfxo9s4pYMU1b", accent: "#25D366", enabled: true, sortOrder: 3 },
  { platform: "instagram", label: "Instagram", description: "Clips and behind the scenes", url: "https://ig.me/j/FJjObnPWb6NMA9yD/", accent: "#E1306C", enabled: true, sortOrder: 4 },
  { platform: "linktree", label: "All links", description: "Everything in one place", url: "https://linktr.ee/dephantomtamil", accent: "#43E660", enabled: true, sortOrder: 5 },
];
