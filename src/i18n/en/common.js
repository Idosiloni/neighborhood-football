// Texts used all over the app. American English; en-GB/common.js has the British differences.
export default {
  appName: 'Neighborhood Football',
  loading: 'Loading…',
  back: 'Back',
  close: 'Close',
  save: 'Save',
  saving: 'Saving…',
  saved: 'Saved ✓',
  cancel: 'Cancel',
  continue: 'Continue',
  edit: 'Edit',
  delete: 'Delete',
  yes: 'Yes',
  no: 'No',
  offline: 'No connection right now. Try again in a moment.',
  failed: 'Something went wrong. Please try again.',
  notConfigured: "The app isn't connected to a server yet: the Supabase keys are missing from the Vercel settings.",
  demoBar: 'Demo mode: everything is saved on this phone only',

  // 0 = Sunday
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  // "Saturday 11/7"
  dayLabel: '{day} {date}',
  // "Saturday 11/7, 9:30 AM"
  gameLabel: '{day} {date}, {time}',

  // Bib colors: the team's name ("Blues") and the short form ("Blue") follow the color.
  colors: {
    blue: { team: 'Blues', short: 'Blue' },
    orange: { team: 'Oranges', short: 'Orange' },
    red: { team: 'Reds', short: 'Red' },
    white: { team: 'Whites', short: 'White' },
    black: { team: 'Blacks', short: 'Black' },
    yellow: { team: 'Yellows', short: 'Yellow' },
    green: { team: 'Greens', short: 'Green' },
    purple: { team: 'Purples', short: 'Purple' },
  },

  language: 'Language',
  languageAuto: 'Automatic',
}
