// Shown on the new screens until whoever runs the server applies the updated schema.sql in Supabase.
export default function NeedsUpdate() {
  return (
    <div className="card empty">
      <div className="empty-emoji">🛠️</div>
      <strong>עוד רגע…</strong>
      <p className="muted">האפליקציה מתעדכנת כרגע. נסו שוב בעוד כמה דקות.</p>
    </div>
  )
}
