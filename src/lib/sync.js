// Taps that show at once and are saved in the background (the "I'm in" button, who came tonight).
// Each key keeps the last thing the user wanted; while a save runs, more taps only change that,
// and one more save follows if needed. onSettled(failed) runs when a key has nothing left to send
// (usually a reload); only then does the key go back to what the server says.
export function createSync(send, onSettled) {
  const keys = new Map() // key -> { want, sent, sending }
  return function set(key, want) {
    const s = keys.get(key) ?? { want, sent: undefined, sending: false }
    s.want = want
    keys.set(key, s)
    if (s.sending) return
    s.sending = true
    ;(async () => {
      let failed = false
      try {
        while (s.sent !== s.want) {
          const w = s.want
          await send(key, w)
          s.sent = w
        }
      } catch {
        failed = true
      }
      // A tap that came in while settling starts its own round with this entry gone.
      keys.delete(key)
      s.sending = false
      await onSettled(key, failed)
    })()
  }
}

