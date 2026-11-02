import { useEffect, useState } from 'react'
import { api } from '../data'

// True when this phone may change things (has an active player's code, or Ido is signed in).
export function useMember() {
  const [member, setMember] = useState(undefined)
  useEffect(() => {
    api.isMember().then(setMember, () => setMember(false))
  }, [])
  return member
}
