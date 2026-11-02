import { usePhoto } from '../lib/photos'

export default function Avatar({ player, size = 44 }) {
  const photo = usePhoto(player)
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {photo ? <img src={photo} alt="" /> : player.emoji || '⚽'}
    </span>
  )
}
