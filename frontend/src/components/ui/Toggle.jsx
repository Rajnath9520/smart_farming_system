import { clsx } from "clsx";

export function Toggle({ checked, onChange, disabled }) {
  return (
    <div
      className={clsx("toggle-wrap", checked && "on", disabled && "opacity-40 cursor-not-allowed")}
      onClick={() => !disabled && onChange?.(!checked)}
    >
      <div className="toggle-thumb" />
    </div>
  );
}