import { clsx } from "clsx";
 

export function Card({ children, className, hover, onClick, padding = "p-5", ...p }) {
  return (
    <div
      className={clsx("card", hover && "card-hover", padding, className)}
      onClick={onClick} {...p}
    >{children}</div>
  );
}