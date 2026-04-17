import { clsx } from "clsx";

export function Skeleton({ className, count = 1 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={clsx("skeleton", className)} />
      ))}
    </>
  );
}