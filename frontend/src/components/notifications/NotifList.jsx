
import {  Empty } from "../ui/Empty";
import { Bell } from "lucide-react";
import { NotifCard } from "./NotifCard";

export function NotifList({ notifs = [], loading, onMarkRead }) {
  if (loading) return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
    </div>
  );
  if (!notifs.length) return (
    <Empty icon={Bell} title="All caught up!" subtitle="No new notifications at the moment." />
  );
  return (
    <div className="space-y-2.5">
      {notifs.map(n => <NotifCard key={n._id} notif={n} onMarkRead={onMarkRead} />)}
    </div>
  );
}