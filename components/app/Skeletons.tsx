/**
 * Loading states shaped like the rooms they stand in for — lines where a
 * conversation will be, posters where the wall will be, prints where the vault will
 * be — so arriving reads as a room filling in rather than a grid of grey boxes.
 */
const S = ({ w, h, r, style }: { w: string | number; h: string | number; r?: number; style?: React.CSSProperties }) => (
  <span className="sk" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

export function HeadlineSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="sk-head" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <S key={i} w={`${[62, 44, 52][i % 3]}%`} h="clamp(3rem, 8vw, 6rem)" r={10} />
      ))}
    </div>
  );
}

export function TeaSkeleton() {
  return (
    <div className="sk-room" aria-busy="true" aria-label="Loading tea">
      <HeadlineSkeleton lines={1} />
      <div className="sk-lines">
        {[88, 64, 76, 40, 70, 55].map((w, i) => (
          <div key={i} className="sk-msg" data-mine={i % 3 === 2}>
            <S w={28} h={28} r={28} />
            <S w={`${w}%`} h={16} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PosterSkeleton() {
  return (
    <div className="sk-room" aria-busy="true" aria-label="Loading">
      <HeadlineSkeleton lines={1} />
      <div className="sk-posters">
        {[0, 1, 2, 3].map((i) => (
          <S key={i} w="100%" h={i === 0 ? "26rem" : "14rem"} r={6} style={{ transform: `rotate(${[-1.2, 1.6, -2, 1][i]}deg)` }} />
        ))}
      </div>
    </div>
  );
}

export function VaultSkeleton() {
  return (
    <div className="sk-room" aria-busy="true" aria-label="Loading the vault">
      <S w="100%" h="clamp(24rem, 58vh, 36rem)" r={6} />
      <div className="sk-prints">
        {[0, 1, 2].map((i) => (
          <S key={i} w="100%" h="15rem" r={3} style={{ transform: `rotate(${[-2, 1.5, -1][i]}deg)` }} />
        ))}
      </div>
    </div>
  );
}

export function PlanSkeleton() {
  return (
    <div className="sk-room" aria-busy="true" aria-label="Loading">
      <HeadlineSkeleton lines={2} />
      {[0, 1].map((i) => (
        <S key={i} w="100%" h={i === 0 ? "16rem" : "9rem"} r={20} style={{ transform: `rotate(${i ? 1 : -0.8}deg)` }} />
      ))}
    </div>
  );
}

/** CREATE: reference frames, the wide one leading, with a slate bar across the top. */
export function StudioSkeleton() {
  return (
    <div className="sk-room" aria-busy="true" aria-label="Loading the studio">
      <HeadlineSkeleton lines={1} />
      <div className="sk-frames">
        {[0, 1, 2].map((i) => (
          <span key={i} className="sk-frame" data-lead={i === 0}>
            <S w="100%" h={i === 0 ? "22rem" : "13rem"} r={4} />
          </span>
        ))}
      </div>
    </div>
  );
}
