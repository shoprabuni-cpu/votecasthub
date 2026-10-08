export type Guide = { slug: string; title: string; description: string; sections: Array<{ title: string; paragraphs: string[] }> };

export const GUIDES: Guide[] = [
  {
    slug: "online-voting-for-awards-in-ghana", title: "Online voting for awards and competitions in Ghana",
    description: "Plan an awards vote on VotecastHub: set categories, introduce nominees, choose free or paid voting and submit your event for review.",
    sections: [
      { title: "Start with the voting rules", paragraphs: ["Decide who can participate, whether voting is free or paid, how many votes are allowed and when voting closes. Publish these rules before asking your community to vote. Paid support voting and a one-vote-per-voter election serve different purposes; choose the format that fits your event."] },
      { title: "Create your event and nominee profiles", paragraphs: ["Create an organizer account and an organization workspace. Add the event name, description, voting dates and instructions, then create categories and add nominees. Use nominee names, biographies and photographs that you have permission to publish.", "Give each category and nominee a useful description. Your community should understand what the award recognizes and why each nominee is participating."] },
      { title: "Choose verification or payment setup", paragraphs: ["For a free vote, choose the event’s voter verification method and voting limit. Email, phone, access codes and an approved voter list support different participation needs. A phone-based event needs sufficient SMS credits. A paid event needs a verified organizer payment account before publication."] },
      { title: "Submit for review before the deadline", paragraphs: ["An event stays private while it is a draft or awaiting platform review. Check that your voting deadline is still in the future and that every active category has a nominee. Submit the event for review, then read any requested changes in your organizer dashboard."] },
      { title: "Promote the approved public link", paragraphs: ["After approval, share the public event link and nominee profile links. Put the event link on your organization’s website, use the same event name in social announcements and include the voting deadline. The public event page offers link sharing and downloadable nominee flyers."] },
    ],
  },
  {
    slug: "planning-a-school-or-association-election", title: "Planning a school or association election",
    description: "A practical organizer guide to voter lists, candidate categories, voting limits and a clear election schedule on VotecastHub.",
    sections: [
      { title: "Agree on eligibility and oversight", paragraphs: ["Before opening voting, agree on eligible voters, positions, candidates, the voting window and how results will be reviewed. Your institution is responsible for its election rules and supervision. Confirm that the platform’s available controls meet those rules before relying on it for a consequential election."] },
      { title: "Use free voting with an appropriate limit", paragraphs: ["Create a category for each position and a nominee profile for each candidate. For one selection per position, use one vote per category. Review the ballot and verification journey with test accounts before the election is published."] },
      { title: "Prepare your voter list", paragraphs: ["Choose voter-list verification when participation must be limited to an approved roster. The roster can identify eligible participants using the supported email, phone or institutional identifiers, including index numbers. Follow the import form’s template and required fields rather than assuming an index number alone grants access.", "A voter redeems the claim credentials provided for their roster entry. Distribute those credentials privately to the correct people. Do not post a voter roster, claim codes or students’ personal information on the public event page."] },
      { title: "Check the schedule and request review early", paragraphs: ["Set a clear opening time and a future closing time. Confirm the time zone, candidates and instructions before submission. The event becomes public only after platform approval. Allow time for requested changes and for eligible voters to receive their access details."] },
      { title: "Explain results and handle changes openly", paragraphs: ["Tell voters when results will be visible. Once voting has started or an event has activity, protected rules and candidate identity changes may need platform correction review. If an eligible expired event is reopened, the organizer must provide a public reason; existing votes and limits remain in place."] },
    ],
  },
  {
    slug: "voter-verification-and-voting-limits", title: "Voter verification and voting limits explained",
    description: "Understand email, phone, access-code and voter-list verification, and choose voting limits that suit your event.",
    sections: [
      { title: "Verification and vote limits do different jobs", paragraphs: ["Verification checks whether an account meets the event’s selected participation requirements. Voting limits determine how many votes that verified account can record. Verifying an email address or phone number confirms access to that contact; it is not a guarantee of a person’s legal identity."] },
      { title: "Email or phone verification", paragraphs: ["Email verification asks participants to use a confirmed email account. Phone verification uses the enabled SMS flow and requires the organizer’s SMS setup and credits. Choose the method that your intended voters can reliably complete."] },
      { title: "Access codes", paragraphs: ["Access-code verification is useful when organizers distribute participation credentials. Give codes only to intended participants and explain the redemption steps. Treat codes as private credentials, especially where codes allow restricted participation."] },
      { title: "An approved voter list", paragraphs: ["Voter-list verification links participation to an organizer-approved roster and claim credentials. Roster identifiers may include emails, phone numbers or index numbers. The list must be available and ready before the organizer submits an event using this method."] },
      { title: "Tell voters what the limit means", paragraphs: ["Use the event’s available voting rules to specify whether the limit applies across the event or within each category. Put the limit in your event instructions, check it in preview and communicate it consistently in announcements. Server-side checks enforce the selected rule when a free vote is recorded."] },
    ],
  },
  {
    slug: "promote-your-event-and-nominees", title: "Promote your event and nominee voting links",
    description: "Share an approved VotecastHub event through your official website, WhatsApp and social channels with clear voting instructions.",
    sections: [
      { title: "Share the public event page", paragraphs: ["Wait until the event is approved and published. Use its public link, not an organizer dashboard or private preview link. Link to the event from your official organization website using the event’s name so participants know what they are opening."] },
      { title: "Give nominees their own links", paragraphs: ["Each active nominee in a public category has a profile link. Nominees can use that link in their social biography, announcements or community messages. The event and nominee pages include sharing tools, and nominee profiles can generate a downloadable flyer."] },
      { title: "Make the announcement useful", paragraphs: ["Include the event name, nominee or category, opening and closing dates, the selected verification method and the public link. For paid voting, include the displayed price per vote. Avoid asking people to send access codes or payment details in public comments."] },
      { title: "Use consistent names and official profiles", paragraphs: ["Use VotecastHub GH consistently when naming the platform. Keep your event title the same across your website and social profiles. Add a real description and an authorized photograph to each nominee profile so participants can recognize the candidate."] },
      { title: "Example announcement", paragraphs: ["Voting for [event name] is open until [date and time, Ghana time]. Explore [category or nominee], read the voting rules and participate here: [public event or nominee link]. [Explain the required verification or displayed price per vote.]"] },
    ],
  },
];
