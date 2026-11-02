// Who is using this phone: one personal code per group he is in, and which group is open now.
// Every request carries the open group's code, and the database shows only that group.
const KEY = 'my-player-code' // the open group's code (same key as before groups existed)
const GROUPS = 'my-groups' // [{ code, id, name }]

const read = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // private mode: works for this visit only
  }
}

export function getMyCode() {
  return read(KEY)
}

export function myGroups() {
  try {
    return JSON.parse(read(GROUPS)) ?? []
  } catch {
    return []
  }
}

// The open group, as far as this phone knows ({ code, id, name } or null).
export function currentGroup() {
  const code = getMyCode()
  return myGroups().find((g) => g.code === code) ?? null
}

// Opens the group of this code. With group ({ id, name }) it is remembered in the list too;
// an older code for the same group is replaced.
export function setMyCode(code, group) {
  const c = code?.trim().toLowerCase() || null
  write(KEY, c)
  if (c && group?.id) {
    const rest = myGroups().filter((g) => g.code !== c && g.id !== group.id)
    write(GROUPS, JSON.stringify([...rest, { code: c, id: group.id, name: group.name }]))
  }
}

// This phone leaves a group (the player stays in it). Opens another group if there is one.
export function forgetMyCode(code) {
  const rest = myGroups().filter((g) => g.code !== code)
  write(GROUPS, JSON.stringify(rest))
  if (getMyCode() === code) write(KEY, rest.at(-1)?.code ?? null)
}

// Switching groups: every screen reloads with the other group's data.
export function openGroup(code) {
  write(KEY, code)
  window.location.hash = '#/'
  window.location.reload()
}
