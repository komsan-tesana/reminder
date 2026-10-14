import { buildSprite, spritePaths, type Outfit, type Pose, type Skin, type Toy } from '../lib/buddySprite'

const pathCache = new Map<string, ReturnType<typeof spritePaths>>()

/** one pose of the cat as crisp SVG; `scale` is screen pixels per sprite pixel */
export default function PixelCat({ pose, outfit = 'none', toy = 'notoy', skin = 'calico', scale = 3 }: { pose: Pose; outfit?: Outfit; toy?: Toy; skin?: Skin; scale?: number }) {
  const sprite = buildSprite(pose, outfit, toy)
  const key = `${pose}|${outfit}|${toy}|${skin}`
  let paths = pathCache.get(key)
  if (!paths) {
    paths = spritePaths(sprite, skin)
    pathCache.set(key, paths)
  }
  return (
    <svg width={sprite.w * scale} height={sprite.h * scale} viewBox={`0 0 ${sprite.w} ${sprite.h}`} shapeRendering="crispEdges" aria-hidden>
      {paths.map((p) => (
        <path key={p.color + p.d.length} d={p.d} fill={p.color} />
      ))}
    </svg>
  )
}
