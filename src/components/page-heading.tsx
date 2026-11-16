import Link from "next/link";
import { Icon } from "./icon";
export function PageHeading({ title, description, home = false }: { title: string; description: string; home?: boolean }) {
  return <><nav className="breadcrumbs" aria-label="Drobečková navigace"><Link href="/" aria-label="Přehled"><Icon name="home"/></Link><span aria-hidden="true">/</span><span aria-current="page">{home ? "Přehled" : title}</span></nav><header className="page-heading"><h1>{title}</h1><p>{description}</p></header></>;
}
