import { Icon, type IconName } from "./icon";
export function EmptyState({ title, description, icon, compact = false }: { title: string; description: string; icon: IconName; compact?: boolean }) {
  return <div className={`empty-state${compact ? " compact" : ""}`}><span className="empty-icon"><Icon name={icon}/></span><h3>{title}</h3><p>{description}</p><span className="availability">Tato část bude dostupná v další etapě.</span></div>;
}
