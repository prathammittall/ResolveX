import { redirect } from "next/navigation";
import { ACTIVE_INCIDENT } from "../../lib/incident-data";

export default function IncidentsIndexPage() {
  redirect(`/incidents/${ACTIVE_INCIDENT.id}`);
}
