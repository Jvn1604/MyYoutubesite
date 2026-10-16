/**
 * DEVELOPMENT FIXTURE: used only until the database exists (phase 7–9).
 * Shapes match the merged DB rows (YouTube data + website overrides).
 * Content is carried over from legacy/index.html; video ids/titles/views
 * are real values from the channel as of 2026-10-16.
 */

export const settings = {
  brand: {
    name: "DePhantom",
    nameTa: "தமிழ்",
    greetingTa: "வணக்கம் நண்பர்களே!",
    community: "Phantom Troupe",
    logoUrl: "/src/assets/fallback/avatar.svg",
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
  sections: ["hero", "stats", "latest", "streams", "games", "schedule", "goal", "videos", "community", "support", "about"]
    .map((key) => ({ key, enabled: true })),
};

export const channel = {
  title: "DePhantom தமிழ்",
  subscriberCount: 1352,
  subscribersHidden: false,
  viewCount: 219369,
  videoCount: 434,
  streamCount: 490,
  avatarUrl: "/src/assets/fallback/avatar.svg",
  bannerUrl: "https://yt3.googleusercontent.com/7NGWBrbpjAhMf7Y7CNqnwwQDpSQc8RGPT1m-Qgwbl0s7cq2OcTBs32KmpDkU0UomlAsj3SIG5w=w1138-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj",
  syncedAt: "2026-10-16T10:00:00Z",
};

const stream = (id, title, publishedAt, views, gameSlug, extra = {}) => ({
  id, title, description: "", publishedAt, durationSeconds: null, kind: "stream", liveState: "ended",
  scheduledStart: null, actualStart: publishedAt, concurrentViewers: null,
  views, likes: null, comments: null, gameSlug, hidden: false, featured: false, priority: 0, ...extra,
});

export const videos = [
  stream("7utpCWTZQpg", "Valor Mortis – Napoleonic era Soulslike – Pt 1", "2026-10-14T13:00:00Z", 1297, "valor-mortis", { featured: true }),
  stream("Y-anq79KB2g", "CONTROL Resonant – Part 4", "2026-10-08T13:00:00Z", 332, "control-resonant"),
  stream("f7PiOS6YpH0", "CONTROL Resonant – Part 3", "2026-10-07T13:00:00Z", 757, "control-resonant"),
  stream("P-Plichv868", "CONTROL Resonant – Part 2", "2026-09-29T13:00:00Z", 1094, "control-resonant"),
  stream("RcEgafYb7HM", "CONTROL Resonant – Part 1", "2026-09-27T13:00:00Z", 791, "control-resonant"),
  stream("DfGnpgtTiXo", "The Blood of Dawnwalker – Part 5", "2026-09-26T13:00:00Z", 1254, "blood-of-dawnwalker"),
  stream("9kQwis2kJFs", "Party Animals with Friends", "2026-09-19T15:00:00Z", 257, "party-animals"),
  stream("T955-y3p-RI", "The Blood of Dawnwalker – Part 4", "2026-09-19T13:00:00Z", 1122, "blood-of-dawnwalker"),
  stream("Ntr3K9VO7LE", "The Blood of Dawnwalker – Part 3", "2026-09-17T13:00:00Z", 934, "blood-of-dawnwalker"),
  stream("l80h8U2d7_E", "The Blood of Dawnwalker – Part 2", "2026-09-16T13:00:00Z", 1831, "blood-of-dawnwalker"),
  stream("yy3khOOd4sQ", "The Blood of Dawnwalker – Part 1", "2026-09-15T13:00:00Z", 2379, "blood-of-dawnwalker"),
  stream("YQAtIyPbd0A", "Onimusha: Way of the Sword – NO DAMAGE / CARNAGE Difficulty (Bishamon sword)", "2026-09-14T13:00:00Z", 784, "onimusha-way-of-the-sword"),
  stream("H4H0Ro3s2eo", "Onimusha: Way of the Sword – ACTION Difficulty 🥲 17 Boss NO DAMAGE", "2026-09-09T13:00:00Z", 1347, "onimusha-way-of-the-sword"),
  stream("lyyB-gKsOBs", "Onimusha: Way of the Sword – Try 18 Rematch boss no damage 🥲", "2026-09-08T13:00:00Z", 417, "onimusha-way-of-the-sword"),
  stream("vWT9NvoMocs", "Onimusha: Way of the Sword – ENDING", "2026-09-07T13:00:00Z", 546, "onimusha-way-of-the-sword"),
];

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

export const schedule = {
  timezone: "Asia/Kuala_Lumpur",
  message: "Live every night. Turn on the 🔔 so YouTube tells you the moment I go live.",
  rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, time: "21:00", title: "Nightly stream", enabled: true })),
  events: [],
  compareZones: [
    { label: "Malaysia", timeZone: "Asia/Kuala_Lumpur" },
    { label: "India", timeZone: "Asia/Kolkata" },
    { label: "Sri Lanka", timeZone: "Asia/Colombo" },
    { label: "Singapore", timeZone: "Asia/Singapore" },
  ],
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
