import { Card } from "../ui/Card";

export function Section({ icon: Icon, title, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-primary-50" style={{ background: "#F7FBF9" }}>
        <div className="w-8 h-8 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-primary-600" />
        </div>
        <h3 className="font-display font-bold text-ink-800 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}