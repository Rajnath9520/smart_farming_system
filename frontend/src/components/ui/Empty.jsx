

export function Empty({ icon: Icon, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {Icon && (
        <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-2">
          <Icon size={28} className="text-primary-400" />
        </div>
      )}
      <p className="font-display font-bold text-ink-700">{title}</p>
      {subtitle && <p className="text-sm text-ink-400 max-w-xs">{subtitle}</p>}
      {action}
    </div>
  );
}