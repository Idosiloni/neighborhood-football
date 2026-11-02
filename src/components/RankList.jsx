import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Avatar from './Avatar'
import Icon from './Icon'
import { positionsText } from '../lib/positions'

function Row({ player, index, count, onMove }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: player.id })

  return (
    <li
      ref={setNodeRef}
      className={`rank-row${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className="rank-num">{index + 1}</span>
      <Avatar player={player} size={36} />
      <span className="rank-name">
        {player.name}
        <small>{positionsText(player)}</small>
      </span>
      <span className="rank-arrows">
        <button type="button" aria-label={`הזז את ${player.name} למעלה`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
          <Icon name="up" size={16} stroke={2.5} />
        </button>
        <button type="button" aria-label={`הזז את ${player.name} למטה`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
          <Icon name="down" size={16} stroke={2.5} />
        </button>
      </span>
      <button
        type="button"
        className="drag-handle"
        ref={setActivatorNodeRef}
        aria-label={`גרור את ${player.name}`}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
    </li>
  )
}

// Ordered list of players. Drag by the handle, or use the arrows.
export default function RankList({ players, onChange }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const move = (from, to) => onChange(arrayMove(players, from, to))

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return
        move(
          players.findIndex((p) => p.id === active.id),
          players.findIndex((p) => p.id === over.id),
        )
      }}
    >
      <SortableContext items={players.map((p) => p.id)} strategy={verticalListSortingStrategy}>
        <ol className="rank-list">
          {players.map((p, i) => (
            <Row key={p.id} player={p} index={i} count={players.length} onMove={move} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}
