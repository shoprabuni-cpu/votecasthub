export type Guide = { slug: string; title: string; description: string; flow: { title: string; start: string; steps?: string[]; branches?: Array<{ label: string; steps: string[] }>; end: string }; sections: Array<{ title: string; paragraphs: string[] }> };

export const GUIDES: Guide[] = [
  {
    slug: "online-voting-for-awards-in-ghana", title: "How to run an online awards vote",
    description: "Plan your event, add nominees, choose how people can vote, and share the event when it is approved.",
    flow: { title: "From idea to voting", start: "Plan your vote", steps: ["Create an event", "Add categories and nominees", "Choose voting rules", "Send the event for review", "Share the public link"], end: "People can vote" },
    sections: [
      { title: "1. Decide how voting will work", paragraphs: ["Before you create the event, decide who can vote, whether voting is free or paid, how many votes people get, and when voting ends. Write the rules in plain English so voters know what to expect."] },
      { title: "2. Create the event and add nominees", paragraphs: ["Create an organizer account. Add your event name, a short description, and the opening and closing times. Then add one category for each award and add the nominees. Only publish names, photos, and details you have permission to use."] },
      { title: "3. Choose how people can vote", paragraphs: ["For a free vote, choose email, phone, a private access code, or an approved voter list. Phone voting needs SMS credits. For paid voting, your organization must connect and verify its payment account before the event can be published."] },
      { title: "4. Check your event and ask for review", paragraphs: ["Make sure the closing time is in the future and each category has a nominee. If you use a voter list, upload it before asking for review. Submit the event. It stays private until the platform approves it. Check your organizer dashboard for any changes the team requests."] },
      { title: "5. Share the public event", paragraphs: ["After approval, copy the public event link and share it on your website, WhatsApp, or social pages. Include the deadline and explain what voters need to enter. You can also share links to individual nominee pages."] },
    ],
  },
  {
    slug: "planning-a-school-or-association-election", title: "How to plan a school or group election",
    description: "Set up positions, candidates, voter access, and a clear election schedule.",
    flow: { title: "Set up a group election", start: "Agree on the election rules", steps: ["Create one category per position", "Add each candidate", "Choose a voter check", "Set the dates and vote limit", "Review and share the approved link"], end: "Voters check in and vote" },
    sections: [
      { title: "1. Agree on the rules first", paragraphs: ["Write down who can vote, which positions are open, who the candidates are, when voting starts and ends, and who will check the results. Your school or group is responsible for running its election. Make sure the available voting options fit your rules before you begin."] },
      { title: "2. Make a clear ballot", paragraphs: ["Create one category for each position, such as President or Treasurer. Add each candidate under the right position. If voters should choose one person for each position, choose one vote per category."] },
      { title: "3. Choose how to check voters", paragraphs: ["If only approved people can vote, choose a voter list and upload the eligible voters. Email and phone entries get a one-time code. For an index number or other ID, give each voter their own private code. Tell voters exactly which details to enter. Never post the list or private codes publicly."] },
      { title: "4. Check the dates and ask for review", paragraphs: ["Set the opening and closing times and tell voters the time zone. Make sure every position has its candidates and the voter list is ready. Send the event for review early. It will become public after approval, so leave time to make any requested changes."] },
      { title: "5. Explain results and changes", paragraphs: ["Tell voters when they can see the results. After voting starts, some event rules and candidate details cannot be changed right away. Ask the platform team to review important corrections. If voting is reopened after it ends, voters can see the reason and existing votes remain counted."] },
    ],
  },
  {
    slug: "voter-verification-and-voting-limits", title: "How voter checks and vote limits work",
    description: "See what voters enter for each method, and understand how many times they can vote.",
    flow: { title: "What does the voter do?", start: "Open the event page", branches: [
      { label: "Email or phone", steps: ["Enter the email or phone number", "Enter the code sent to it", "Choose and submit votes"] },
      { label: "Approved list with an ID", steps: ["Enter the index number or ID", "Enter the private code from the organizer", "Choose and submit votes"] },
      { label: "Private access code", steps: ["Enter the code from the organizer", "Choose and submit votes"] },
      { label: "Paid voting", steps: ["Choose a nominee and number of votes", "Pay by Mobile Money or card"] },
    ], end: "Your vote is recorded if the event rules allow it" },
    sections: [
      { title: "A voter check and a vote limit are different", paragraphs: ["The voter check decides who is allowed to vote. The vote limit decides how many votes they can cast. For example, a voter may be allowed one vote in each category, but their voter-list entry may set a total limit of one vote for the whole event."] },
      { title: "Email or phone", paragraphs: ["The voter enters their email or phone number on the event page. We send a one-time code to that address or number. They enter the code, then vote. They do not need to visit a separate sign-in page. If the event uses an approved list, their email or phone must be on that list. Phone codes arrive by SMS."] },
      { title: "Index number or another ID on a voter list", paragraphs: ["The voter enters the ID and the private code given to them by the organizer. The ID must be on the approved list, and the private code must match it. The ID alone is not enough. Each voter should keep their own code private."] },
      { title: "Private access code", paragraphs: ["The organizer gives voters a code. The voter enters that code on the event page, then votes. Share each code privately with the person who should use it."] },
      { title: "Paid voting", paragraphs: ["For paid events, voters choose a nominee and how many votes to buy. They pay with Mobile Money or a card. The vote is recorded after payment succeeds."] },
      { title: "Check the total limit too", paragraphs: ["A voter-list entry can have a total number of votes for the whole event. Category rules also apply. The voter must follow whichever limit they reach first. Organizers should tell voters both limits before voting starts."] },
    ],
  },
  {
    slug: "promote-your-event-and-nominees", title: "How to share your event with voters",
    description: "Share the right event link and clearly explain the dates and steps to vote.",
    flow: { title: "Get the word out", start: "Wait for event approval", steps: ["Copy the public event link", "Add the dates and voting instructions", "Share on official channels", "Answer voter questions"], end: "Voters open the event and take part" },
    sections: [
      { title: "1. Copy the public event link", paragraphs: ["Wait until the event is approved. Open the public event page and copy its link. Do not share the private organizer page or preview link."] },
      { title: "2. Tell people what to expect", paragraphs: ["Include the event name, when voting opens and closes (Ghana time), and how people will vote. Say if they need an email or phone code, an ID and private code, or payment. For paid votes, include the price shown on the event page."] },
      { title: "3. Share from official pages", paragraphs: ["Post the link on your organization website, WhatsApp groups, and official social pages. You can also share a nominee’s own page. Use the same event name everywhere so people can find the right vote."] },
      { title: "4. Keep private details private", paragraphs: ["Do not post voter lists, private voting codes, or payment details in public comments. If people need a code, send it to them privately."] },
      { title: "Example message", paragraphs: ["Voting for [event name] opens [date and time] and closes [date and time] Ghana time. To vote, open this link and follow the instructions: [public event link]. You will need [email or phone code / your ID and private code / payment]."] },
    ],
  },
];
