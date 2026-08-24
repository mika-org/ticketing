import { EventWorkspace } from '@/features/events/event_workspace';
export default async function Page({ params }: { params: Promise<{ event_id:string; section?:string[] }> }) { const value=await params; return <EventWorkspace event_id={value.event_id} section={value.section?.[0]??'detail'}/>; }
