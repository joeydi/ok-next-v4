import { SITE } from "./site";

// The privacy policy at /privacy. Every claim here describes what the code does,
// so when the booking flow, the site check, the analytics or a provider changes,
// change this too and move `updated`. In the text, [label](url) is a link and
// {email} is the contact address.

export type PrivacyBlock = string | { list: string[] };

export type PrivacySection = { id: string; heading: string; blocks: PrivacyBlock[] };

export const privacy = {
  title: "Privacy",
  metaTitle: "Privacy policy",
  metaDescription: `What ${SITE.name} collects when you book a call or check your site, why, who handles it and how long it’s kept.`,
  /** When the policy last changed, as YYYY-MM-DD. */
  updated: "2026-10-13",
  intro: `This site is run by ${SITE.author}, trading as ${SITE.name}, in ${SITE.location}. It collects as little as it can: nothing when you read it, and only what’s needed when you book a call or ask for a site check. Nothing is sold, and there are no ad trackers.`,
  sections: [
    {
      id: "booking",
      heading: "Booking a call",
      blocks: [
        "When you book a call I ask for your name, your email address, your timezone and the answers to a couple of questions about your project. I use them to:",
        {
          list: [
            "put the call on my Google Calendar, with you as a guest and a Google Meet link;",
            "email you a confirmation with a calendar invite, reminders a day and an hour before the call, and a note if it moves or is cancelled;",
            "email me the booking, so I can prepare and reply to you;",
            "let you move or cancel the call through the private link in those emails.",
          ],
        },
        "The booking is kept in my database for two years after the call, then deleted automatically. The calendar event and the emails stay in my calendar and inbox, like any other appointment, until I delete them.",
      ],
    },
    {
      id: "site-check",
      heading: "The site check",
      blocks: [
        "The site check looks at the address you give it, using Google’s PageSpeed Insights for the speed scores. The results are kept for 30 days so a review request can refer back to them, and a record of the check for 90 days.",
        "If you ask for a personal review, I also take your email address. It’s used to send you a link to confirm the request, and once you confirm, to send me the results with your address so I can reply. A confirmed request is kept for two years.",
      ],
    },
    {
      id: "google",
      heading: "Google Calendar and Google user data",
      blocks: [
        `The booking page uses Google’s Calendar API with my own Google account only. You never sign in with Google here, and the site never sees your Google account. With my permission it:`,
        {
          list: [
            "reads the free and busy times on the calendars I choose, to work out which times to offer, without reading those events' titles, guests or details;",
            "lists my calendars, so I can choose them on a settings page only I can reach;",
            "creates, moves and deletes the events for calls booked through this site.",
          ],
        },
        "That data is used only to offer times and keep the bookings on my calendar. It isn’t used for advertising, isn’t sold, and isn’t shared with anyone, apart from the event itself, which you’re a guest on.",
        `${SITE.name}'s use and transfer of information received from Google APIs will adhere to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.`,
      ],
    },
    {
      id: "analytics",
      heading: "Analytics, logs and spam protection",
      blocks: [
        "The site counts visits with Vercel Web Analytics and measures page speed with Vercel Speed Insights. Both work without cookies and only report totals; they don’t identify you or follow you to other sites. The site sets no cookies of its own.",
        "To stop abuse, the booking form and the site check limit how often one connection can use them. That needs your IP address, which is held for up to an hour (and an email address for a day, for the site check’s limit), then forgotten. Their logs record a short scrambled code instead of your IP address, and only the domain of your email address, never the whole address.",
        "Those forms also use Cloudflare Turnstile to tell people from bots. It runs only when you send a form.",
      ],
    },
    {
      id: "providers",
      heading: "Who handles data for me",
      blocks: [
        "A few services run parts of the site and handle data only on my behalf:",
        {
          list: [
            "Vercel hosts the site and runs the forms;",
            "Turso stores the bookings and site checks;",
            "Upstash holds the short-lived rate limits;",
            "SendGrid (Twilio) sends the emails;",
            "Google provides the calendar, Meet and the PageSpeed scores;",
            "Cloudflare serves the site’s images and video and runs Turnstile.",
          ],
        },
        "Like any web host, these services see your IP address when your browser asks them for something, and keep standard request logs for a short time.",
      ],
    },
    {
      id: "choices",
      heading: "Your choices",
      blocks: [
        "You can move or cancel a call at any time through the link in your booking emails. To see, correct or delete anything I hold about you, write to {email} and I’ll reply within 30 days.",
      ],
    },
    {
      id: "changes",
      heading: "Changes",
      blocks: [
        "If this policy changes, the date at the top of the page changes with it. For anything else, write to {email}.",
      ],
    },
  ] satisfies PrivacySection[],
};
