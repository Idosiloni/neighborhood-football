import { useEffect, useState } from 'react'
import { api } from '../data'

let ready
// True once the database has groups (schema version 3).
export function useSchemaReady() {
  const [ok, setOk] = useState(ready === undefined ? undefined : ready)
  useEffect(() => {
    if (ready !== undefined) return
    api.schemaVersion().then((v) => {
      ready = v >= 3
      setOk(ready)
    })
  }, [])
  return ok
}
