import { HeadlineSkeleton } from "@/components/app/Skeletons";

export default function Loading() {
  return (
    <div className="sk-room" aria-busy="true" aria-label="Loading">
      <HeadlineSkeleton lines={2} />
    </div>
  );
}
