/* Made-up piles for the demo page. Every name, company and address here is invented. */
window.PileSprintSamples = {
  inbox: [
    { id: "m1", kind: "reply", title: "Can we move Thursday to Friday?", subtitle: "Jordan Pike · 9:12", bodyLabel: "What they wrote",
      body: "Hi! Something came up on Thursday afternoon. Would Friday at the same time work for you? If not, any morning next week is fine.\n\nThanks,\nJordan" },
    { id: "m2", kind: "newsletter", title: "Your weekly digest: 14 new posts", subtitle: "Lumen Weekly · yesterday",
      body: "This week: five ways to plan a quarter, a long read on remote rituals, and the tools our readers liked most." },
    { id: "m3", kind: "reply", title: "Invoice 2291 question", subtitle: "Sam Okafor · Tuesday", bodyLabel: "What they wrote",
      body: "The invoice lists 12 hours but we agreed on 10 for that week. Could you check and send a corrected one?" },
    { id: "m4", kind: "newsletter", title: "Last chance: 30% off annual plans", subtitle: "Paperkite · Monday",
      body: "Our autumn offer ends tonight at midnight." },
    { id: "m5", kind: "reply", title: "Intro: Riley, who runs ops at Fernway", subtitle: "Alex Moreno · Monday", bodyLabel: "What they wrote",
      body: "Riley, meet Casey. Casey, Riley is the person I mentioned who rebuilt their whole onboarding. I'll let you two take it from here." },
    { id: "m6", kind: "newsletter", title: "Your storage is 80% full", subtitle: "Cloudbox · last week",
      fields: [["Used", "40 GB of 50 GB"], ["Largest folder", "Phone backups"]] },
    { id: "m7", kind: "reply", title: "Feedback on the draft", subtitle: "Morgan Lee · last week", bodyLabel: "What they wrote",
      body: "Read it twice. The first half is great. The second half repeats the case study; I would cut it to one paragraph and end on the numbers." }
  ],
  inboxKinds: {
    // right sends the words on the card, with 3 seconds to undo; with no words yet it only keeps the message
    reply: { title: "Waiting on your answer", keep: function (it) { return it.draft ? "Send" : "Answer later"; }, drop: "Nothing to answer",
      now: function (it) { return !!it.draft; }, icons: { keep: "send" } },
    newsletter: { title: "Newsletters and notices", keep: "Keep", drop: "Unsubscribe", icons: { drop: "trash" } }
  },
  // what a drafting service would write for each reply (the demo pretends to take a moment)
  drafts: {
    m1: "Friday at the same time works for me. See you then!",
    m3: "You are right, it should be 10 hours. A corrected invoice is on its way today. Sorry for the mix-up.",
    m5: "Thanks Alex! Riley, great to meet you. Would a 20-minute call next Tuesday or Wednesday suit you?",
    m7: "Thank you, that is really useful. I will cut the case study to one paragraph and end on the numbers."
  },
  // what a scoring service said about each applicant
  applicantChecks: {
    a1: { fit: 86, checks: [["Ran a support team", "ok", "40 people, 3 years"], ["Spanish and English", "ok", "Help centre in both"], ["Help desk tools", "mid", "Not named on the CV"]] },
    a2: { fit: 22, checks: [["Ran a support team", "no", "No team lead role"], ["Spanish and English", "mid", "English only on the CV"], ["Cover letter for this job", "no", "Names another company"]] },
    a3: { fit: 58, checks: [["Ran a support team", "no", "1 year in support, no team"], ["Spanish and English", "ok", "Both"], ["Help desk tools", "ok", "Two certificates"]] },
    a4: { fit: 79, checks: [["Ran a support team", "ok", "Leads 6 today"], ["Spanish and English", "ok", "Both"], ["Hands on", "mid", "Says so; check in the call"]] },
    a5: { fit: 40, checks: [["Required questions", "no", "Both left empty"], ["Ran a support team", "mid", "Unclear"]] }
  },
  photos: [
    ["IMG_2041.jpg", "Sunset over the hills", "Sep 3, 7:41 PM", "21 KB"],
    ["IMG_2042.jpg", "Almost the same as the one before", "Sep 3, 7:41 PM", "21 KB"],
    ["IMG_2043.jpg", "Blurry", "Sep 3, 7:42 PM", "18 KB"],
    ["IMG_2050.jpg", "", "Sep 6, 11:05 AM", "26 KB"],
    ["IMG_2051.jpg", "Looks like it was taken in a pocket", "Sep 6, 11:06 AM", "10 KB"],
    ["IMG_2063.jpg", "", "Sep 9, 8:30 AM", "22 KB"],
    ["Screenshot_0412.png", "A screenshot of a receipt", "Sep 10, 2:14 PM", "3 KB"],
    ["IMG_2077.jpg", "", "Sep 12, 5:50 PM", "24 KB"]
  ].map(function (p) {
    return { id: p[0], title: p[0], subtitle: p[1], image: "examples/photos/" + p[0], alt: p[1] || p[0], fields: [["Taken", p[2]], ["Size", p[3]]] };
  }),
  applicantsCSV: [
    "id,name,subtitle,notes,Applied for,City,Years",
    "a1,Robin Hale,Applied 2 days ago,\"Ran support for a 40-person team. Wrote their help centre from scratch, in English and Spanish.\",Support lead,Lisbon,7",
    "a2,Quinn Ade,Applied today,Cover letter is for a different company.,Support lead,Remote,1",
    "a3,Taylor Brook,Applied 5 days ago,\"Moved from retail into support last year; certificates in two help desk tools.\",Support lead,Madrid,2",
    "a4,Avery Lin,Applied yesterday,\"Leads a team of 6 today, wants to stay hands on.\",Support lead,Porto,9",
    "a5,Jamie Cole,Applied 3 days ago,No answer to the two required questions.,Support lead,Remote,"
  ].join("\n")
};
