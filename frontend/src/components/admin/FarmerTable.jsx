
import { Button} from "../ui/Button";
import { Badge } from "../ui/Badge";
import {  Skeleton } from "../ui/Skeleton";
import {  CheckCircle2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function FarmersTable({ farmers = [], loading, onToggle }) {
  if (loading) return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[600px]">
        <thead>
          <tr>
            <th>Farmer</th>
            <th>Farm</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Login</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {farmers.map(f => (
            <tr key={f._id}>
              <td>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#059669,#14B8A6)" }}>
                    {f.name?.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-ink-800 text-sm">{f.name}</p>
                    <p className="text-xs text-ink-400">{f.email}</p>
                  </div>
                </div>
              </td>
              <td>
                <p className="text-sm text-ink-700">{f.farms?.[0]?.name || "—"}</p>
                <p className="text-xs text-ink-400">{f.farms?.[0]?.area} acres</p>
              </td>
              <td><Badge variant={f.role === "admin" ? "info" : "neutral"}>{f.role}</Badge></td>
              <td>
                <div className="flex items-center gap-1.5">
                  {f.isActive
                    ? <><CheckCircle2 size={14} className="text-primary-500" /><span className="text-xs font-semibold text-primary-600">Active</span></>
                    : <><AlertCircle  size={14} className="text-red-400" /><span className="text-xs font-semibold text-red-500">Inactive</span></>
                  }
                </div>
              </td>
              <td>
                <span className="text-xs text-ink-400">
                  {f.lastLogin ? formatDistanceToNow(new Date(f.lastLogin), { addSuffix: true }) : "—"}
                </span>
              </td>
              <td>
                <Button
                  variant={f.isActive ? "outline" : "primary"}
                  size="xs"
                  onClick={() => onToggle?.(f._id)}
                >
                  {f.isActive ? "Deactivate" : "Activate"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}